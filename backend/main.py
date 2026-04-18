"""
BlindSpot.AI — FastAPI Backend
Main application with all REST endpoints.
"""
import os
import io
import uuid
import logging
from typing import Optional, List
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from models import (
    init_db, get_db, Project, SeedImage, GeneratedImage,
    ProjectStatus, SessionLocal
)
from storage import upload_bytes, get_presigned_url, ensure_bucket, upload_file
from tasks import celery_app, train_lora_task, full_pipeline_task
from services.adversarial_agent import run_vulnerability_scan, STRESSORS

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting BlindSpot.AI API...")
    init_db()
    ensure_bucket()
    yield
    logger.info("Shutting down BlindSpot.AI API")


app = FastAPI(
    title="BlindSpot.AI API",
    description="Industrial-grade synthetic data generation for AI robustness",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs(os.path.join(os.path.dirname(__file__), "data"), exist_ok=True)
app.mount("/media", StaticFiles(directory=os.path.join(os.path.dirname(__file__), "data")), name="media")


# ─── Pydantic Schemas ──────────────────────────────────────────────────────────

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class ModelEndpointRequest(BaseModel):
    endpoint: str

class ProjectResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    status: str
    progress: int
    current_stage: Optional[str]
    model_endpoint: Optional[str]
    vulnerability_vector: Optional[dict]
    dataset_url: Optional[str]
    image_count: int
    label_count: int
    seed_images: List[dict] = []
    created_at: Optional[str]
    updated_at: Optional[str]

    class Config:
        from_attributes = True


def _project_to_dict(p: Project) -> dict:
    return {
        "id": p.id,
        "name": p.name,
        "description": p.description,
        "status": p.status.value if p.status else "created",
        "progress": p.progress or 0,
        "current_stage": p.current_stage,
        "model_endpoint": p.model_endpoint,
        "vulnerability_vector": p.vulnerability_vector,
        "dataset_url": p.dataset_url,
        "image_count": p.image_count or 0,
        "label_count": p.label_count or 0,
        "seed_images": [
            {"id": si.id, "filename": si.filename, "url": si.url}
            for si in p.seed_images
        ],
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


# ─── Projects ─────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok", "service": "BlindSpot.AI API"}


@app.post("/api/projects")
def create_project(body: ProjectCreate, db: Session = Depends(get_db)):
    project = Project(
        id=str(uuid.uuid4()),
        name=body.name,
        description=body.description,
        status=ProjectStatus.CREATED,
        progress=0,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    logger.info(f"Created project: {project.id} — {project.name}")
    return _project_to_dict(project)


@app.get("/api/projects")
def list_projects(db: Session = Depends(get_db)):
    projects = db.query(Project).order_by(Project.created_at.desc()).all()
    return [_project_to_dict(p) for p in projects]


@app.get("/api/projects/{project_id}")
def get_project(project_id: str, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return _project_to_dict(project)


@app.delete("/api/projects/{project_id}")
def delete_project(project_id: str, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    db.delete(project)
    db.commit()
    return {"deleted": True}


# ─── Seed Images ──────────────────────────────────────────────────────────────

@app.post("/api/projects/{project_id}/seed-images")
async def upload_seed_images(
    project_id: str,
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if len(files) < 1 or len(files) > 10:
        raise HTTPException(status_code=400, detail="Upload between 1 and 10 seed images")

    uploaded = []
    for file in files:
        data = await file.read()
        ext = Path(file.filename).suffix or ".jpg"
        storage_key = f"seeds/{project_id}/{uuid.uuid4().hex}{ext}"
        upload_bytes(data, storage_key, content_type=file.content_type or "image/jpeg")
        url = get_presigned_url(storage_key)

        seed = SeedImage(
            project_id=project_id,
            filename=file.filename,
            storage_key=storage_key,
            url=url,
        )
        db.add(seed)
        uploaded.append({"filename": file.filename, "storage_key": storage_key, "url": url})

    db.commit()
    logger.info(f"Uploaded {len(uploaded)} seed images to project {project_id}")
    return {"uploaded": len(uploaded), "images": uploaded}


# ─── Model Endpoint ───────────────────────────────────────────────────────────

@app.post("/api/projects/{project_id}/model-endpoint")
def set_model_endpoint(project_id: str, body: ModelEndpointRequest, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    project.model_endpoint = body.endpoint
    db.commit()
    return {"endpoint": body.endpoint, "message": "Model endpoint registered"}


# ─── LoRA Training ────────────────────────────────────────────────────────────

@app.post("/api/projects/{project_id}/train-lora")
def trigger_lora_training(project_id: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not project.seed_images:
        raise HTTPException(status_code=400, detail="No seed images uploaded")

    storage_keys = [si.storage_key for si in project.seed_images]
    background_tasks.add_task(train_lora_task.delay, project_id, storage_keys)
    project.celery_task_id = "local-bg-task-lora"
    project.status = ProjectStatus.TRAINING_LORA
    db.commit()

    return {"task_id": "local-bg-task-lora", "message": "LoRA training started"}


# ─── Adversarial Scan ─────────────────────────────────────────────────────────

def run_scan_bg(project_id, model_endpoint, seed_paths):
    from models import SessionLocal
    try:
        v_vec = run_vulnerability_scan(project_id, model_endpoint, seed_paths)
        db = SessionLocal()
        p = db.query(Project).filter(Project.id == project_id).first()
        if p:
            p.vulnerability_vector = v_vec
            p.status = ProjectStatus.CREATED
            p.current_stage = f"Scan complete — {len(v_vec)} blind spots found"
            db.commit()
        db.close()
    except Exception as e:
        logger.error(f"Scan failed: {e}")

@app.post("/api/projects/{project_id}/run-adversarial-scan")
def run_adversarial_scan_endpoint(project_id: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    project.status = ProjectStatus.SCANNING
    project.current_stage = "Running adversarial scan..."
    db.commit()

    seed_paths = []
    tmp_dir = Path("/tmp") / f"scan_{project_id}"
    tmp_dir.mkdir(exist_ok=True)

    from storage import download_file
    for i, si in enumerate(project.seed_images[:5]):
        local = str(tmp_dir / f"seed_{i}.jpg")
        try:
            download_file(si.storage_key, local)
            seed_paths.append(local)
        except Exception as e:
            logger.warning(f"Could not download seed image: {e}")

    background_tasks.add_task(run_scan_bg, project_id, project.model_endpoint or "", seed_paths)

    return {"message": "Scan started in background"}


# ─── Full Generation Pipeline ─────────────────────────────────────────────────

@app.post("/api/projects/{project_id}/generate")
def trigger_generation(project_id: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    background_tasks.add_task(full_pipeline_task.delay, project_id)
    project.celery_task_id = "local-bg-task-gen"
    project.status = ProjectStatus.GENERATING
    project.progress = 0
    project.current_stage = "Pipeline queued..."
    db.commit()

    return {"task_id": "local-bg-task-gen", "message": "Generation pipeline started"}


# ─── Status ───────────────────────────────────────────────────────────────────

@app.get("/api/projects/{project_id}/status")
def get_status(project_id: str, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    celery_state = None
    if project.celery_task_id:
        try:
            # If eager mode, this might throw NotImplementedError without backend
            task_result = celery_app.AsyncResult(project.celery_task_id)
            celery_state = task_result.state
        except Exception as e:
            logger.warning(f"Skipping celery state fetch (local mode): {e}")
            celery_state = "unknown"

    return {
        "project_id": project_id,
        "status": project.status.value if project.status else "created",
        "progress": project.progress or 0,
        "current_stage": project.current_stage,
        "celery_state": celery_state,
        "image_count": project.image_count or 0,
        "label_count": project.label_count or 0,
        "error_message": project.error_message,
    }


# ─── Dataset ──────────────────────────────────────────────────────────────────

@app.get("/api/projects/{project_id}/dataset")
def get_dataset(project_id: str, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.status != ProjectStatus.READY:
        raise HTTPException(status_code=400, detail="Dataset not ready yet")

    # Refresh presigned URL
    storage_key = f"datasets/{project_id}/dataset_{project_id}.zip"
    try:
        fresh_url = get_presigned_url(storage_key, expiry=3600)
        project.dataset_url = fresh_url
        db.commit()
    except Exception:
        fresh_url = project.dataset_url

    return {
        "project_id": project_id,
        "download_url": fresh_url,
        "image_count": project.image_count,
        "label_count": project.label_count,
        "vulnerability_vector": project.vulnerability_vector,
        "format": "COCO JSON + YOLO labels",
        "expires_in_seconds": 3600,
    }


@app.get("/api/stressors")
def list_stressors():
    return {"stressors": STRESSORS}

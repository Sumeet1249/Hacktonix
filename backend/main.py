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

from storage import upload_bytes, get_presigned_url, ensure_bucket, upload_file
from tasks import celery_app, train_lora_task, full_pipeline_task
import httpx
from services.adversarial_agent import run_vulnerability_scan, STRESSORS

SUPABASE_URL = "https://cauhevaqfmqprdgfsikl.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNhdWhldmFxZm1xcHJkZ2ZzaWtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MDUxMzQsImV4cCI6MjA5MjA4MTEzNH0.lq5iWeZrqAv-KKF_Nu6IveEC9pQ7MrmR8vAGQSHfo7c"

def sync_supabase(method, table, data=None, params=None):
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    with httpx.Client() as client:
        if method == "GET":
            return client.get(url, headers=headers, params=params).json()
        elif method == "PATCH":
            return client.patch(url, headers=headers, params=params, json=data)
        elif method == "POST":
            return client.post(url, headers=headers, json=data)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Ensure cloud connections
    yield
    # Shutdown: Clean up any open streams
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


# ─── Projects ─────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok", "service": "BlindSpot.AI API"}


@app.post("/api/projects")
def create_project_endpoint(body: ProjectCreate):
    data = sync_supabase("POST", "projects", data={
        "name": body.name,
        "description": body.description,
        "status": "created",
        "progress": 0
    })
    if not data:
        raise HTTPException(status_code=500, detail="Failed to create project in cloud")
    return data[0]


@app.get("/api/projects")
def list_projects_endpoint():
    data = sync_supabase("GET", "projects", params={"order": "created_at.desc"})
    return data or []


@app.get("/api/projects/{project_id}")
def get_project_endpoint(project_id: str):
    data = sync_supabase("GET", "projects", params={"id": f"eq.{project_id}", "select": "*"})
    if not data:
        raise HTTPException(status_code=404, detail="Project not found")
    return data[0]


@app.delete("/api/projects/{project_id}")
def delete_project_endpoint(project_id: str):
    sync_supabase("DELETE", "projects", params={"id": f"eq.{project_id}"})
    return {"deleted": True}


# ─── Seed Images ──────────────────────────────────────────────────────────────

@app.post("/api/projects/{project_id}/seed-images")
async def upload_seed_images_endpoint(
    project_id: str,
    files: List[UploadFile] = File(...),
):
    # This is a fallback; frontend now uploads to Supabase Storage directly.
    # But let's keep it working via sync_supabase for completeness.
    uploaded = []
    for file in files:
        data = await file.read()
        ext = Path(file.filename).suffix or ".jpg"
        storage_key = f"{project_id}/{uuid.uuid4().hex}{ext}"
        
        # Upload using same bucket
        upload_bytes(data, f"project-seeds/{storage_key}", content_type=file.content_type)
        url = f"{SUPABASE_URL}/storage/v1/object/public/project-seeds/{storage_key}"

        uploaded.append({"filename": file.filename, "url": url})

    # Update metadata in 프로젝트 table
    curr_data = sync_supabase("GET", "projects", params={"id": f"eq.{project_id}", "select": "seed_images"})
    existing = (curr_data[0].get("seed_images") or []) if curr_data else []
    
    sync_supabase("PATCH", "projects", 
        data={
            "seed_images": existing + uploaded,
            "image_count": len(existing) + len(uploaded)
        },
        params={"id": f"eq.{project_id}"}
    )
    
    return {"uploaded": len(uploaded), "images": uploaded}


# ─── Model Endpoint ───────────────────────────────────────────────────────────

@app.post("/api/projects/{project_id}/model-endpoint")
def set_model_endpoint(project_id: str, body: ModelEndpointRequest):
    # Update Supabase
    sync_supabase("PATCH", "projects", 
        data={"model_endpoint": body.endpoint},
        params={"id": f"eq.{project_id}"}
    )
    return {"endpoint": body.endpoint, "message": "Model endpoint registered in cloud"}


# ─── LoRA Training ────────────────────────────────────────────────────────────

@app.post("/api/projects/{project_id}/train-lora")
def trigger_lora_training(project_id: str, background_tasks: BackgroundTasks):
    data = sync_supabase("GET", "projects", params={"id": f"eq.{project_id}", "select": "seed_images"})
    if not data:
        raise HTTPException(status_code=404, detail="Project not found")
    
    project = data[0]
    seed_images = project.get("seed_images", [])
    if not seed_images:
        raise HTTPException(status_code=400, detail="No seed images uploaded")

    storage_keys = [si.get("storage_key", "") for si in seed_images]
    background_tasks.add_task(train_lora_task.delay, project_id, storage_keys)
    
    sync_supabase("PATCH", "projects", 
        data={
            "status": "training_lora",
            "current_stage": "Starting LoRA training..."
        },
        params={"id": f"eq.{project_id}"}
    )

    return {"task_id": "local-bg-task-lora", "message": "LoRA training started via cloud-sync"}


# ─── Adversarial Scan ─────────────────────────────────────────────────────────

def run_scan_bg(project_id, model_endpoint, seed_paths):
    try:
        v_vec = run_vulnerability_scan(project_id, model_endpoint, seed_paths)
        # Update Supabase project with results
        sync_supabase("PATCH", "projects", 
            data={
                "vulnerability_vector": v_vec,
                "status": "ready",
                "current_stage": f"Scan complete — {len(v_vec)} blind spots found"
            },
            params={"id": f"eq.{project_id}"}
        )
    except Exception as e:
        logger.error(f"Scan failed: {e}")
        sync_supabase("PATCH", "projects", 
            data={
                "status": "ready",
                "error_message": str(e)
            },
            params={"id": f"eq.{project_id}"}
        )

@app.post("/api/projects/{project_id}/run-adversarial-scan")
def run_adversarial_scan_endpoint(project_id: str, background_tasks: BackgroundTasks):
    # Fetch project from Supabase
    data = sync_supabase("GET", "projects", params={"id": f"eq.{project_id}", "select": "*"})
    if not data:
        raise HTTPException(status_code=404, detail="Project not found in Supabase")
    
    project = data[0]
    
    # Update status to scanning
    sync_supabase("PATCH", "projects", 
        data={
            "status": "scanning",
            "current_stage": "Running adversarial scan..."
        },
        params={"id": f"eq.{project_id}"}
    )

    # Prepare seeds
    seed_paths = []
    tmp_dir = Path("data") / f"scan_{project_id}"
    tmp_dir.mkdir(parents=True, exist_ok=True)

    with httpx.Client() as client:
        # Get seeds from the project metadata we just fetched
        for i, si in enumerate(project.get("seed_images", [])[:5]):
            local = str(tmp_dir / f"seed_{i}.jpg")
            try:
                r = client.get(si["url"])
                if r.status_code == 200:
                    with open(local, "wb") as f:
                        f.write(r.content)
                    seed_paths.append(local)
            except Exception as e:
                logger.warning(f"Could not download seed image: {e}")

    background_tasks.add_task(run_scan_bg, project_id, project.get("model_endpoint") or "", seed_paths)

    return {"message": "Scan started via Supabase"}


# ─── Full Generation Pipeline ─────────────────────────────────────────────────

@app.patch("/api/projects/{project_id}/status")
def update_project_status(project_id: str, payload: dict):
    # Pass updates directly to Supabase via sync_supabase helper
    try:
        data = sync_supabase("PATCH", "projects", 
            data=payload,
            params={"id": f"eq.{project_id}"}
        )
        return {"status": "success", "updated": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/projects/{project_id}/generate")
def trigger_generation(project_id: str, background_tasks: BackgroundTasks):
    # Verify project exists in Supabase
    data = sync_supabase("GET", "projects", params={"id": f"eq.{project_id}", "select": "id"})
    if not data:
        raise HTTPException(status_code=404, detail="Project not found in Supabase")

    background_tasks.add_task(full_pipeline_task.delay, project_id)
    
    sync_supabase("PATCH", "projects", 
        data={
            "status": "generating",
            "progress": 0,
            "current_stage": "Pipeline queued in cloud..."
        },
        params={"id": f"eq.{project_id}"}
    )

    return {"message": "Generation pipeline started via cloud-sync"}


# ─── Status ───────────────────────────────────────────────────────────────────

@app.get("/api/projects/{project_id}/status")
def get_status(project_id: str):
    data = sync_supabase("GET", "projects", params={"id": f"eq.{project_id}", "select": "*"})
    if not data:
        raise HTTPException(status_code=404, detail="Project not found")
    
    project = data[0]
    return {
        "project_id": project_id,
        "status": project.get("status", "created"),
        "progress": project.get("progress", 0),
        "current_stage": project.get("current_stage"),
        "image_count": project.get("image_count", 0),
        "label_count": project.get("label_count", 0),
        "error_message": project.get("error_message"),
    }


# ─── Dataset ──────────────────────────────────────────────────────────────────

@app.get("/api/projects/{project_id}/dataset")
def get_dataset(project_id: str):
    data = sync_supabase("GET", "projects", params={"id": f"eq.{project_id}", "select": "*"})
    if not data:
        raise HTTPException(status_code=404, detail="Project not found")
    
    project = data[0]
    if project.get("status") != "ready":
        raise HTTPException(status_code=400, detail="Dataset not ready yet")

    # Refresh presigned URL
    storage_key = f"datasets/{project_id}/dataset_{project_id}.zip"
    try:
        fresh_url = get_presigned_url(storage_key, expiry=3600)
    except Exception:
        fresh_url = project.get("dataset_url")

    return {
        "project_id": project_id,
        "download_url": fresh_url,
        "image_count": project.get("image_count", 0),
        "label_count": project.get("label_count", 0),
        "vulnerability_vector": project.get("vulnerability_vector", {}),
        "format": "COCO JSON + YOLO labels",
        "expires_in_seconds": 3600,
    }


@app.get("/api/stressors")
def list_stressors():
    return {"stressors": STRESSORS}

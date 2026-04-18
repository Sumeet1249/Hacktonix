"""
Celery Task Definitions
All long-running ML pipeline tasks run here asynchronously.
"""
import os
import tempfile
import logging
from pathlib import Path
from typing import List

from celery import Celery
from sqlalchemy.orm import Session

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# If running locally without docker/redis, we can disable broker/backend check in eager mode
celery_app = Celery("blindspot")
celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_track_started=True,
    worker_max_tasks_per_child=1,
    task_soft_time_limit=7200,
    task_time_limit=9000,
    task_always_eager=True,
)

logger = logging.getLogger(__name__)


def _update_project(project_id: str, **kwargs):
    """Helper to update project status in DB."""
    from models import SessionLocal, Project
    db = SessionLocal()
    try:
        project = db.query(Project).filter(Project.id == project_id).first()
        if project:
            for k, v in kwargs.items():
                setattr(project, k, v)
            db.commit()
    finally:
        db.close()


@celery_app.task(bind=True, name="tasks.train_lora_task")
def train_lora_task(self, project_id: str, seed_image_storage_keys: List[str]):
    """Download seed images and run LoRA fine-tuning."""
    from models import ProjectStatus
    from storage import download_file, get_s3_client
    from services.lora_trainer import train_lora

    _update_project(project_id, status=ProjectStatus.TRAINING_LORA, current_stage="Downloading seed images", progress=0)

    tmpdir = tempfile.mkdtemp()
    local_paths = []

    for i, key in enumerate(seed_image_storage_keys):
        local = os.path.join(tmpdir, f"seed_{i}.jpg")
        try:
            download_file(key, local)
            local_paths.append(local)
        except Exception as e:
            logger.warning(f"[task:train_lora] Failed to download {key}: {e}")

    def progress_cb(pct):
        _update_project(project_id, progress=pct, current_stage=f"Training LoRA adapter ({pct}%)")
        self.update_state(state="PROGRESS", meta={"progress": pct, "stage": "Training LoRA"})

    _update_project(project_id, current_stage="Training LoRA adapter", progress=5)

    weights_path = train_lora(
        project_id=project_id,
        seed_image_paths=local_paths,
        progress_callback=progress_cb,
    )

    _update_project(project_id, lora_weights_path=weights_path, progress=100, current_stage="LoRA training complete")
    return {"weights_path": weights_path}


@celery_app.task(bind=True, name="tasks.full_pipeline_task")
def full_pipeline_task(self, project_id: str):
    """
    Full 4-stage generation pipeline:
    Stage 1: Image Generation (25%)
    Stage 2: Physics Refinement (50%)
    Stage 3: Auto-Labeling (75%)
    Stage 4: Package & Upload (100%)
    """
    from models import SessionLocal, Project, ProjectStatus
    from storage import upload_file, get_presigned_url
    from services.generative_engine import generate_images
    from services.physics_layer import apply_physics_stressors
    from services.auto_labeler import generate_coco_dataset

    db = SessionLocal()
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        logger.error(f"[pipeline] Project {project_id} not found")
        return

    vulnerability_vector = project.vulnerability_vector or {}
    lora_weights_path = project.lora_weights_path
    db.close()

    if not vulnerability_vector:
        # Use default stressors if no scan was run
        vulnerability_vector = {
            "occlusion_50": 0.48,
            "rain_heavy": 0.41,
            "fog_dense": 0.35,
            "night_low": 0.52,
        }

    import os
    USE_MOCK = os.getenv("MOCK_ML", "true").lower() == "true"
    if USE_MOCK:
        # HACKATHON OVERRIDE: Route directly to Blender 3D Engine instead of fake 2D mocks!
        import subprocess
        import shutil
        from pathlib import Path
        import zipfile
        
        _update_project(project_id, status=ProjectStatus.GENERATING, current_stage="Triggering 3D Blender Engine...", progress=10)
        
        # Define paths for Blender engine hook
        root_dir = Path(__file__).parent.parent
        blender_script = root_dir / "test_blender.py"
        blender_exe = r"C:\Program Files\Blender Foundation\Blender 5.1\blender.exe"
        blender_out = root_dir / "blender_output"
        
        # 1. Execute the 3D Engine Headless
        try:
             # Try common Blender paths or just 'blender' from PATH
             blender_candidates = [
                 blender_exe,
                 r"C:\Program Files\Blender Foundation\Blender 4.2\blender.exe",
                 r"C:\Program Files\Blender Foundation\Blender 4.1\blender.exe",
                 r"C:\Program Files\Blender Foundation\Blender 4.0\blender.exe",
                 "blender"
             ]
             
             success = False
             for cand in blender_candidates:
                 try:
                     subprocess.run([cand, "--background", "--python", str(blender_script)], check=True, capture_output=True)
                     success = True
                     logger.info(f"Successfully ran Blender using: {cand}")
                     break
                 except (subprocess.CalledProcessError, FileNotFoundError):
                     continue
             
             if not success:
                 logger.warning("Blender Engine not found or failed. Falling back to Mock 3D Data...")
                 # Fallback: Create mock output folder if it doesn't exist
                 blender_out.mkdir(exist_ok=True)
                 # Create some dummy files if it's empty
                 if not any(blender_out.iterdir()):
                     for i in range(3):
                         # Just use an empty txt for yolo and a dummy jpg
                         Path(blender_out / f"synthetic_3d_{i:03d}.txt").write_text("0 0.5 0.5 0.2 0.2")
                         Path(blender_out / f"synthetic_3d_{i:03d}.jpg").write_text("fake_image_data")
        except Exception as e:
             logger.error(f"Blender Engine hook/fallback failed: {e}")
             
        _update_project(project_id, current_stage="Packaging deterministic 3D annotations...", progress=80)
        
        # 2. Package directly into pipeline formatting
        OUTPUT_DIR = os.getenv("GENERATED_DIR", os.path.join(root_dir, "data", "generated"))
        dataset_dir = Path(OUTPUT_DIR) / project_id / "dataset"
        images_dir = dataset_dir / "images"
        labels_dir = dataset_dir / "yolo_labels"
        images_dir.mkdir(parents=True, exist_ok=True)
        labels_dir.mkdir(parents=True, exist_ok=True)
        
        img_count = 0
        if blender_out.exists():
            for f in blender_out.glob("*.jpg"):
                 if "VERIFIED" not in f.name:
                     shutil.copy(f, images_dir / f.name)
                     img_count += 1
            for f in blender_out.glob("*.txt"):
                 shutil.copy(f, labels_dir / f.name)
                 
        yaml_content = "path: .\ntrain: images\nval: images\n\nnc: 1\nnames: ['target_object']\n"
        with open(dataset_dir / "dataset.yaml", "w") as f:
             f.write(yaml_content)
             
        zip_path = str(dataset_dir.parent / f"dataset_{project_id}.zip")
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
             for fpath in dataset_dir.rglob("*"):
                  if fpath.is_file():
                       # Standard zip structure: images/, labels/
                       zf.write(fpath, fpath.relative_to(dataset_dir))
                       
        # 3. Upload to standard DB/storage like the mock pipeline
        from storage import upload_file, get_presigned_url
        
        storage_key = f"datasets/{project_id}/dataset_{project_id}.zip"
        upload_file(zip_path, storage_key, content_type="application/zip")
        dataset_url = get_presigned_url(storage_key, expiry=86400 * 7)
        
        _update_project(
            project_id, 
            status=ProjectStatus.READY, 
            current_stage="Generation complete", 
            progress=100,
            dataset_url=dataset_url,
            image_count=img_count,
            label_count=img_count
        )
        
        logger.info(f"Blender Engine Pipeline Complete for {project_id}")
        return

    # ─── STAGE 1: Generate Images ──────────────────────────────
    _update_project(project_id, status=ProjectStatus.GENERATING, current_stage="Generating synthetic images", progress=5)

    def gen_progress(pct):
        actual = 5 + int(pct * 0.35)
        _update_project(project_id, progress=actual, current_stage=f"Generating images ({pct}%)")
        self.update_state(state="PROGRESS", meta={"progress": actual, "stage": "Generating images"})

    generated_pairs = generate_images(
        project_id=project_id,
        lora_weights_path=lora_weights_path or "",
        vulnerability_vector=vulnerability_vector,
        images_per_stressor=int(os.getenv("IMAGES_PER_STRESSOR", "8")),
        progress_callback=gen_progress,
    )

    _update_project(project_id, progress=40, current_stage="Image generation complete")

    # ─── STAGE 2: Physics Refinement ───────────────────────────
    _update_project(project_id, current_stage="Applying physics refinement", progress=42)

    def phys_progress(pct):
        actual = 40 + int(pct * 0.20)
        _update_project(project_id, progress=actual, current_stage=f"Physics refinement ({pct}%)")
        self.update_state(state="PROGRESS", meta={"progress": actual, "stage": "Physics refinement"})

    refined_pairs = apply_physics_stressors(
        project_id=project_id,
        image_stressor_pairs=generated_pairs,
        progress_callback=phys_progress,
    )

    _update_project(project_id, progress=62, current_stage="Physics refinement complete")

    # ─── STAGE 3: Auto-Labeling ─────────────────────────────────
    _update_project(project_id, status=ProjectStatus.LABELING, current_stage="Auto-labeling dataset", progress=64)

    def label_progress(pct):
        actual = 62 + int(pct * 0.25)
        _update_project(project_id, progress=actual, current_stage=f"Auto-labeling ({pct}%)")
        self.update_state(state="PROGRESS", meta={"progress": actual, "stage": "Auto-labeling"})

    zip_path, img_count, label_count = generate_coco_dataset(
        project_id=project_id,
        image_stressor_pairs=refined_pairs,
        progress_callback=label_progress,
    )

    _update_project(project_id, progress=90, current_stage="Uploading dataset")

    # ─── STAGE 4: Upload to MinIO ───────────────────────────────
    storage_key = f"datasets/{project_id}/dataset_{project_id}.zip"
    upload_file(zip_path, storage_key, content_type="application/zip")
    dataset_url = get_presigned_url(storage_key, expiry=86400 * 7)

    _update_project(
        project_id,
        status=ProjectStatus.READY,
        current_stage="Complete",
        progress=100,
        dataset_url=dataset_url,
        image_count=img_count,
        label_count=label_count,
    )

    logger.info(f"[pipeline] Project {project_id} complete: {img_count} images, {label_count} labels")
    return {"status": "ready", "image_count": img_count, "label_count": label_count, "dataset_url": dataset_url}

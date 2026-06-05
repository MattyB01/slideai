import io
import traceback
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from parser import parse_pptx_from_bytes as parse_pptx
from writer import build_pptx

app = FastAPI(title="SlideAI Python Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/parse")
async def parse_pptx_endpoint(file: UploadFile = File(...)):
    if not file.filename or not file.filename.endswith(".pptx"):
        raise HTTPException(400, "Only .pptx files are accepted")
    try:
        content = await file.read()
        presentation = parse_pptx(content)
        return presentation
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(500, f"Parse error: {str(e)}")


@app.post("/build")
async def build_pptx_endpoint(data: dict):
    try:
        pptx_bytes = build_pptx(data)
        return Response(
            content=pptx_bytes,
            media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
            headers={"Content-Disposition": "attachment; filename=slideai-export.pptx"},
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(500, f"Build error: {str(e)}")


if __name__ == "__main__":
    import os
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)

from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import io

app = FastAPI()

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.post("/upload")
async def upload_ai_logic(file: UploadFile = File(...)):
    image_bytes = await file.read()
    

    image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
    
    print(f"AI is processing: {file.filename}")
    print(f"Image Size: {image.size}") # Shows width and height


    return {
        "crop_type": "Tomato",
        "condition": "Late Blight",
        "confidence_score": 0.92,
        "recommendation": "Apply copper-based fungicide."
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
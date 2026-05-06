# CropScan V2 Roadmap

This branch moves CropScan from a class prototype toward a defensible product story: real-field diagnosis, honest uncertainty, safer auth, and a clearer business path.

## Build Now

1. Real-field model training
   - Train with PlantVillage plus PlantDoc mapped into the existing 38 CropScan classes.
   - Report PlantVillage and PlantDoc metrics separately.
   - Save calibration metadata with each model, not just raw accuracy.

2. Honest diagnosis states
   - `confident`: model agreement, high max probability, clear class margin, low entropy.
   - `uncertain_need_more_photos`: user should add close-up, back-of-leaf, or environment photo.
   - `out_of_scope`: not a supported crop/leaf image.

3. Security hardening
   - Resend-backed password reset OTP.
   - Welcome email on signup, with non-blocking fallback if email fails.
   - Upload file size and image type enforcement.
   - Basic rate limiting on auth, upload, and chat.

4. Multi-photo diagnosis
   - Frontend should collect close-up, leaf-back, and environment photos.
   - Backend should accept multiple files and reason over them as one case.
   - This matters because single-photo diagnosis is exactly where PlantVillage-style models fail.

## Build Next

1. Server-side scan history
   - Store scan records in MongoDB.
   - Store images in S3-compatible storage such as Cloudflare R2.
   - Keep localStorage only as a temporary offline cache.

2. Follow-up loop
   - Ask whether the recommendation helped after 3, 7, and 14 days.
   - Store the user-confirmed outcome as training feedback.
   - This is the data moat, not the first model.

3. Local decision support
   - Add weather and disease-pressure context for the user's county.
   - Show what to do today instead of only showing scan history.

4. Business layer
   - Keep recommendations generic until products are vetted.
   - Later, recommend verified product categories and route to affiliate or local supplier links.
   - Avoid medical-style certainty and avoid pushing products from low-confidence scans.

## Later

1. Offline mode
   - Start with a TorchScript or ONNX MobileNet artifact.
   - Use offline inference for first-pass triage.
   - Use cloud AI only when the user consents to richer explanation or expert-level support.

2. Extension pilot
   - Collect local real-field images with confirmed labels.
   - Build the pitch around Knox County field data instead of generic public datasets.

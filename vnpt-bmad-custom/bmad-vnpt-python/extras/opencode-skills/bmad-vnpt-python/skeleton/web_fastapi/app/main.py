from fastapi import FastAPI
from app.api.routes import router

app = FastAPI(title="sample-fastapi-app")
app.include_router(router)

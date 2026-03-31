import pandas as pd
import glob
import json
import os

db = {
    "counters": [],
    "maps_all": {},
    "maps_vod": {}
}

def load_and_clean(filepath):
    try:
        df = pd.read_csv(filepath, encoding="latin1", sep=";")
    except:
        df = pd.read_csv(filepath, encoding="latin1", sep=",")
    df.columns = [str(c).strip() for c in df.columns]
    
    # df.to_json() convierte los NaN matemáticos a "null" (formato JSON legal) de forma automática
    json_str = df.to_json(orient="records", force_ascii=False)
    return json.loads(json_str)

# 1. Leer Matriz de Counters
db["counters"] = load_and_clean("data/matriz_counters_draft.csv")

# 2. Leer todos los mapas
map_files = glob.glob("data/*.csv")
for file in map_files:
    if "matriz" in file.lower(): 
        continue
        
    filename = os.path.basename(file).replace(".csv", "")
    parts = filename.split("_")
    if len(parts) < 2: continue
    
    map_name = parts[0]
    map_type = parts[1].lower()
    
    if map_type == "all":
        db["maps_all"][map_name] = load_and_clean(file)
    elif map_type == "vod":
        db["maps_vod"][map_name] = load_and_clean(file)

# 3. Guardar el JSON validado
output_path = "../frontend/public/db.json"
with open(output_path, "w", encoding="utf-8") as f:
    json.dump(db, f, ensure_ascii=False)

print(f"Base de datos generada con éxito en: {output_path}")
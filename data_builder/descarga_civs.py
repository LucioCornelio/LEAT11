import os
import urllib.request
import time

# Tu lista completa de civilizaciones
civs = ["Armenians", "Aztecs", "Bengalis", "Berbers", "Bohemians", "Britons", "Bulgarians", "Burgundians", "Burmese", "Byzantines", "Celts", "Chinese", "Cumans", "Dravidians", "Ethiopians", "Franks", "Georgians", "Goths", "Gurjaras", "Hindustanis", "Huns", "Incas", "Italians", "Japanese", "Jurchens", "Khitans", "Khmer", "Koreans", "Lithuanians", "Magyars", "Malay", "Malians", "Mapuche", "Mayans", "Mongols", "Muisca", "Persians", "Poles", "Portuguese", "Romans", "Saracens", "Shu", "Sicilians", "Slavs", "Spanish", "Tatars", "Teutons", "Tupi", "Turks", "Vietnamese", "Vikings", "Wei", "Wu"]

# Ruta a la carpeta del frontend
save_dir = "../frontend/public/civs"
os.makedirs(save_dir, exist_ok=True)

# URL base del repositorio de SiegeEngineers
base_url = "https://raw.githubusercontent.com/SiegeEngineers/aoe2techtree/master/img/Civs/{}.png"

print("Iniciando saqueo de iconos...")

for civ in civs:
    file_name = f"{civ.lower()}.png"
    file_path = os.path.join(save_dir, file_name)
    
    if not os.path.exists(file_path):
        url = base_url.format(civ.lower())
        try:
            urllib.request.urlretrieve(url, file_path)
            print(f"✅ {civ} descargado.")
        except Exception as e:
            print(f"❌ Error con {civ}: No encontrado en la base oficial.")
        time.sleep(0.2)  # Pausa de cortesía para no saturar el servidor
    else:
        print(f"⏭️ {civ} ya existe, saltando.")

print("¡Operación terminada!")
"""
Genera asistentes.json a partir del listado de asistentes en Excel.
Uso: python3 generar_listado.py listado.xlsx > asistentes.json
Deja un resumen (duplicados unificados, casos a revisar) en la salida de error.

Espera dos columnas: "Nombre y apellido" y "DNI" (el DNI puede estar vacío).
"""
import json
import re
import sys
import unicodedata
import pandas as pd

PARTICULAS = {"de", "del", "la", "las", "los", "y", "von", "van", "da", "di", "e"}


def espacios(s):
    return re.sub(r"\s+", " ", str(s)).strip()


def sin_acentos(s):
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def clave_nombre(nombre):
    """Igual para 'Lucas Agustín Baletti' y 'baletti lucas agustin'."""
    tokens = sin_acentos(nombre).lower().split()
    return " ".join(sorted(tokens))


def prolijo(nombre):
    """Corrige MAYÚSCULAS / minúsculas sueltas; deja como está lo que ya viene bien escrito."""
    salida = []
    for i, p in enumerate(nombre.split()):
        if len(p) > 1 and (p.isupper() or p.islower()):
            p = p.lower() if (p.lower() in PARTICULAS and i > 0) else p.capitalize()
        salida.append(p)
    return " ".join(salida)


def main():
    if len(sys.argv) < 2:
        print("Uso: python3 generar_listado.py listado.xlsx > asistentes.json", file=sys.stderr)
        sys.exit(1)

    df = pd.read_excel(sys.argv[1], dtype=str)
    cols = {c.lower().strip(): c for c in df.columns}
    c_nombre = cols.get("nombre y apellido") or cols.get("nombre")
    c_dni = cols.get("dni") or cols.get("documento")
    if not (c_nombre and c_dni):
        print(f"No encuentro las columnas. Columnas del archivo: {list(df.columns)}", file=sys.stderr)
        sys.exit(1)

    filas = []
    for _, r in df.iterrows():
        if pd.isna(r[c_nombre]) or not espacios(r[c_nombre]):
            continue
        dni = None
        if not pd.isna(r[c_dni]):
            d = re.sub(r"\D", "", str(r[c_dni]).split(".")[0])
            dni = d or None
        filas.append({"nombre": prolijo(espacios(r[c_nombre])), "dni": dni})
    total_original = len(filas)

    # 1) Unificar por DNI (misma persona escrita distinto): me quedo con el nombre más completo
    por_dni, sin_dni = {}, []
    unificados = []
    for f in filas:
        if f["dni"] is None:
            sin_dni.append(f)
        elif f["dni"] in por_dni:
            previo = por_dni[f["dni"]]
            unificados.append((previo["nombre"], f["nombre"], f["dni"]))
            if len(f["nombre"]) > len(previo["nombre"]):
                previo["nombre"] = f["nombre"]
        else:
            por_dni[f["dni"]] = dict(f)
    finales = list(por_dni.values())

    # 2) Los que no tienen DNI: fuera si el mismo nombre ya está con DNI, o repetido entre los sin DNI
    claves_con_dni = {clave_nombre(f["nombre"]) for f in finales}
    vistos = set()
    for f in sin_dni:
        k = clave_nombre(f["nombre"])
        if k in claves_con_dni or k in vistos:
            unificados.append((f["nombre"], "(sin DNI, ya estaba)", ""))
            continue
        vistos.add(k)
        finales.append(f)

    finales.sort(key=lambda f: sin_acentos(f["nombre"]).lower())

    # 3) Casos para revisar: mismo nombre, DNI distintos (posible error de tipeo)
    por_clave = {}
    for f in finales:
        por_clave.setdefault(clave_nombre(f["nombre"]), []).append(f)
    revisar = [v for v in por_clave.values() if len(v) > 1]

    # Id estable por persona (DNI o, si no tiene, el nombre): así volver a cargar no duplica a nadie
    salida = []
    for f in finales:
        id_ = "d" + f["dni"] if f["dni"] else "n" + re.sub(r"[^a-z0-9]+", "-", clave_nombre(f["nombre"])).strip("-")
        salida.append({"id": id_, "nombre": f["nombre"], "dni": f["dni"]})
    assert len({s["id"] for s in salida}) == len(salida), "ids repetidos"
    print(json.dumps(salida, ensure_ascii=False, indent=1))

    e = sys.stderr
    print(f"Filas en el Excel: {total_original}", file=e)
    print(f"Asistentes a cargar: {len(finales)} ({sum(1 for f in finales if not f['dni'])} sin DNI)", file=e)
    print(f"Duplicados unificados: {len(unificados)}", file=e)
    for a, b, d in unificados:
        print(f"   - {a} | {b} | {d}", file=e)
    if revisar:
        print("A REVISAR (mismo nombre, DNI distinto; se cargaron los dos):", file=e)
        for grupo in revisar:
            print("   - " + " / ".join(f"{f['nombre']} ({f['dni']})" for f in grupo), file=e)


if __name__ == "__main__":
    main()

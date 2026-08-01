# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['roulette_app\\main.py'],
    pathex=[],
    binaries=[],
    datas=[('roulette_app\\ui', 'roulette_app/ui'), ('admin_app\\ui', 'admin_app/ui')],
    hiddenimports=['backend', 'backend.main', 'backend.database', 'backend.auth', 'backend.limiter', 'roulette_app', 'roulette_app.local_server', 'uvicorn.logging', 'uvicorn.loops', 'uvicorn.loops.auto', 'uvicorn.protocols', 'uvicorn.protocols.http', 'uvicorn.protocols.http.auto', 'uvicorn.protocols.websockets', 'uvicorn.protocols.websockets.auto', 'uvicorn.lifespan', 'uvicorn.lifespan.on', 'sqlalchemy.sql.default_comparator', 'sqlite3'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='TikTok_Roulette_Client',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='TikTok_Roulette_Client',
)

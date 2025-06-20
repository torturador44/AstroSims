# -*- coding: utf-8 -*-
from __future__ import annotations
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.widgets import Slider
from matplotlib.animation import FuncAnimation
import matplotlib.image as mpimg
import os
import panel as pn

# ------------------- Cargar y rotar 180° la imagen del espectro ------------
IMG_FILE = r"C:\Users\diego\OneDrive\Escritorio\AstroSims\espectro.jpg" # copia la imagen junto al .py o ajusta ruta
if not os.path.isfile(IMG_FILE):
    raise FileNotFoundError(f'Falta {IMG_FILE}.')

spectrum_img = np.rot90(mpimg.imread(IMG_FILE), 2)

# ------------------- Datos espectroscópicos (μm) ---------------------------
ABSORPTION_LINES: dict[str, list[float]] = {
    'O₂':  [0.245, 0.630, 0.760],
    'O₃':  [0.255],
    'Na':  [0.589],
    'K':   [0.770],
    'H₂O': [0.94, 1.13, 1.40, 1.90, 2.70],
    'CH₄': [1.70, 2.30, 3.30],
    'CO₂': [1.44, 1.60, 2.00, 4.26],
    'CO':  [2.35, 4.60],
    'N₂O': [4.50],
}
PEAK_WIDTH = 0.03

LAM_MIN, LAM_MAX = 0.38, 0.75  # rango visible en μm

# -------------------- Funciones científicas y utilidades -------------------

def absorption_strength(lam: float) -> float:
    return sum(np.exp(-0.5 * ((lam - c) / PEAK_WIDTH) ** 2)
               for cs in ABSORPTION_LINES.values() for c in cs)

_lams = np.linspace(0.2, 5.0, 3000)
_MAX_STRENGTH = max(absorption_strength(l) for l in _lams)
AMP_MIN, AMP_MAX = 0.005, 0.12
amp_from_lambda = lambda lam: AMP_MIN + (AMP_MAX - AMP_MIN) * (absorption_strength(lam) / _MAX_STRENGTH)
current_absorbers = lambda lam, tol=0.04: [g for g, cs in ABSORPTION_LINES.items() if any(abs(lam-c) < tol for c in cs)]

def wavelength_to_rgb(lmbd: float):
    t = (lmbd - 0.38) / (0.75 - 0.38)
    t = np.clip(t, 0, 1)
    return (t, max(0, 1 - 4 * abs(t - 0.5)), 1 - t)

# ------------------- Parámetros de animación ------------------------------
N_MOLECULES = 50          # <- más partículas
CELL_SIZE   = 1.0
INTERVAL_MS = 16          # <- ~60 fps
np.random.seed(2)

# ------------------------ Construcción de la interfaz ----------------------
fig = plt.figure(figsize=(11, 4))
plt.subplots_adjust(left=0.05, right=0.97, top=0.9, bottom=0.18)
fig.patch.set_facecolor('black')
fig.canvas.manager.set_window_title('Simulador de Espectroscopía')

ax_spec = plt.axes([0.06, 0.35, 0.40, 0.55], facecolor='black')
ax_spec.imshow(spectrum_img, extent=[LAM_MIN, LAM_MAX, 0, 1], aspect='auto')
ax_spec.set_xlabel('Longitud de onda (μm)', color='white', fontsize=12)
ax_spec.set_yticks([])
ax_spec.set_title('Espectro visible', color='white', fontsize=12)
line_lambda = ax_spec.axvline(x=0.55, color='white', linestyle='--', linewidth=2)

ax_slider = plt.axes([0.06, 0.20, 0.40, 0.05], facecolor='#222')
slider = Slider(ax_slider, label='λ (μm)', valmin=LAM_MIN, valmax=LAM_MAX,
                valinit=0.55, valstep=0.001, color='#00e0ff')
slider.label.set_color('white'); slider.valtext.set_color('white')

ax_text = plt.axes([0.06, 0.05, 0.40, 0.08]); ax_text.axis('off')
text_detection = ax_text.text(0.5, 0.5, '', ha='center', va='center', fontsize=12, color='white', wrap=True)

ax_cell = plt.axes([0.50, 0.10, 0.45, 0.80], facecolor='black')
ax_cell.set_xlim(0, CELL_SIZE); ax_cell.set_ylim(0, CELL_SIZE)
ax_cell.set_aspect('equal'); ax_cell.set_xticks([]); ax_cell.set_yticks([])
ax_cell.set_title('Moléculas en la atmósfera', color='white', fontsize=12)

base_pos = np.random.rand(N_MOLECULES, 2) * CELL_SIZE
scatter = ax_cell.scatter(base_pos[:, 0], base_pos[:, 1], s=60,
                          c='#ffd65a', edgecolors='#ff9f40')
current_lambda = slider.val

# ----------------------- Callbacks y animación ----------------------------

def on_slider(val):
    global current_lambda
    current_lambda = val
    line_lambda.set_xdata([val, val]); line_lambda.set_color(wavelength_to_rgb(val))
    gases = current_absorbers(val)
    text_detection.set_text('Absorben: ' + ', '.join(gases) if gases else 'Sin absorción fuerte')
    fig.canvas.draw_idle()

slider.on_changed(on_slider)

def animate(_):
    amp = amp_from_lambda(current_lambda)
    jitter = np.random.uniform(-amp, amp, base_pos.shape)
    scatter.set_offsets(np.clip(base_pos + jitter, 0, CELL_SIZE))
    return scatter,

ani = FuncAnimation(fig, animate, interval=INTERVAL_MS, blit=True, cache_frame_data=False)

on_slider(current_lambda)

pn.extension()

app = pn.Column(pn.pane.Matplotlib(fig, tight=True, sizing_mode='stretch_both'))
app.servable()
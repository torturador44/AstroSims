# -*- coding: utf-8 -*-
"""
Tránsito exoplanetario — versión Panel/Pyodide
================================================
Esta versión está preparada para:
• Desarrollo local con `panel serve transito.py`
• Exportación a HTML autosuficiente con `panel convert transito.py --to pyodide-worker`
"""

import numpy as np
import matplotlib.pyplot as plt
from matplotlib.widgets import Slider
from matplotlib.patches import Circle
import panel as pn

pn.extension('matplotlib')

# --- Parámetros iniciales ---
R_STAR = 1.0
R_PLANET_INIT = 0.1
X_INIT = -2.0

# --- Colores ---
COLOR_STAR = 'gold'
COLOR_PLANET = 'black'
COLOR_CURVE = 'red'
COLOR_POINT = 'dodgerblue'
BACKGROUND_COLOR = 'black'
TEXT_COLOR = 'white'

# --- Sliders rango ---
SLIDER_X_MIN, SLIDER_X_MAX = -3.0, 3.0
SLIDER_R_MIN, SLIDER_R_MAX = 0.01, R_STAR

# --- Flujo ---

def calcular_flujo_vectorizado(x_arr, R_p, R_s):
    r = np.abs(x_arr)
    flux = np.ones_like(r)
    A_s = np.pi * R_s ** 2
    mask_full = r <= np.abs(R_s - R_p)
    if np.any(mask_full & (R_p <= R_s)):
        flux[mask_full & (R_p <= R_s)] = 1 - (np.pi * R_p ** 2) / A_s
    if np.any(mask_full & (R_s < R_p)):
        flux[mask_full & (R_s < R_p)] = 1 - (np.pi * R_s ** 2) / A_s
    mask_part = (r < (R_s + R_p)) & (r > np.abs(R_s - R_p))
    if np.any(mask_part):
        rp = r[mask_part]
        arg1 = np.clip((rp ** 2 + R_p ** 2 - R_s ** 2) / (2 * rp * R_p), -1, 1)
        arg2 = np.clip((rp ** 2 + R_s ** 2 - R_p ** 2) / (2 * rp * R_s), -1, 1)
        part1 = R_p ** 2 * np.arccos(arg1)
        part2 = R_s ** 2 * np.arccos(arg2)
        part3 = 0.5 * np.sqrt(np.maximum(0, (-rp + R_p + R_s) * (rp + R_p - R_s) * (rp - R_p + R_s) * (rp + R_p + R_s)))
        overlap = part1 + part2 - part3
        flux[mask_part] = 1 - overlap / A_s
    return flux

# --- Figura ---
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 6))
fig.patch.set_facecolor(BACKGROUND_COLOR)
plt.subplots_adjust(left=0.1, right=0.9, top=0.9, bottom=0.35)

# --- Panel sistema con estrellas ---
ax1.set_aspect('equal')
ax1.set_facecolor(BACKGROUND_COLOR)
ax1.set_xlim(-2 * R_STAR, 2 * R_STAR)
ax1.set_ylim(-1.5 * R_STAR, 1.5 * R_STAR)
ax1.set_title('Sistema Estrella‑Planeta', color=TEXT_COLOR)
ax1.set_xlabel('Posición X (R*)', color=TEXT_COLOR)
ax1.set_ylabel('Posición Y (R*)', color=TEXT_COLOR)

# Cielo estrellado (200 puntos)
N_STARS = 200
star_x = np.random.uniform(-2 * R_STAR, 2 * R_STAR, N_STARS)
star_y = np.random.uniform(-1.5 * R_STAR, 1.5 * R_STAR, N_STARS)
ax1.scatter(star_x, star_y, s=2, color='white', alpha=0.8, linewidths=0)

estrella = Circle((0, 0), R_STAR, color=COLOR_STAR, zorder=1)
ax1.add_patch(estrella)
planeta = Circle((X_INIT, 0), R_PLANET_INIT, color=COLOR_PLANET, zorder=2)
ax1.add_patch(planeta)

# --- Panel curva de luz ---
xs = np.linspace(SLIDER_X_MIN, SLIDER_X_MAX, 500)
flux_init = calcular_flujo_vectorizado(xs, R_PLANET_INIT, R_STAR)
curva, = ax2.plot(xs, flux_init, color=COLOR_CURVE, lw=2)
pt, = ax2.plot([X_INIT], [calcular_flujo_vectorizado(np.array([X_INIT]), R_PLANET_INIT, R_STAR)], 'o',
               color=COLOR_POINT, ms=8)
ax2.set_facecolor(BACKGROUND_COLOR)
ax2.set_title('Curva de luz del tránsito', color=TEXT_COLOR)
ax2.set_xlabel('Posición X del planeta (R*)', color=TEXT_COLOR)
ax2.set_ylabel('Flujo observado', color=TEXT_COLOR)
ax2.tick_params(colors=TEXT_COLOR)
ax2.grid(ls='--', alpha=0.3, color='gray')

# Ajuste dinámico eje Y

def upd_ylim(Rp):
    min_f = 1 - (np.pi * Rp ** 2) / (np.pi * R_STAR ** 2)
    ax2.set_ylim(min(min_f, 0.98) - 0.01, 1.005)

upd_ylim(R_PLANET_INIT)

# --- Sliders ---
ax_sx = plt.axes([0.25, 0.2, 0.5, 0.03], facecolor='#333')
sl_x = Slider(ax_sx, 'Posición horizontal del planeta (R*)', SLIDER_X_MIN, SLIDER_X_MAX,
              valinit=X_INIT, color='#1e90ff')
sl_x.label.set_color(TEXT_COLOR); sl_x.valtext.set_color(TEXT_COLOR)

ax_sr = plt.axes([0.25, 0.15, 0.5, 0.03], facecolor='#333')
sl_r = Slider(ax_sr, 'Radio del planeta (R*)', SLIDER_R_MIN, SLIDER_R_MAX,
              valinit=R_PLANET_INIT, color='#1e90ff')
sl_r.label.set_color(TEXT_COLOR); sl_r.valtext.set_color(TEXT_COLOR)

# --- Callback ---

def actualizar(_):
    x = sl_x.val; Rp = sl_r.val
    planeta.center = (x, 0); planeta.set_radius(Rp)
    pt.set_data([x], [calcular_flujo_vectorizado(np.array([x]), Rp, R_STAR)])
    curva.set_ydata(calcular_flujo_vectorizado(xs, Rp, R_STAR))
    upd_ylim(Rp)
    fig.canvas.draw_idle()

sl_x.on_changed(actualizar)
sl_r.on_changed(actualizar)

# ------------------- Panel wrapper -------------------
app = pn.Column(pn.pane.Matplotlib(fig, tight=True, sizing_mode='stretch_both'))
app.servable()

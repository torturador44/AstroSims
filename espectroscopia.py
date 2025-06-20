import numpy as np
import matplotlib.pyplot as plt
import panel as pn

pn.extension()

# Rango de longitudes de onda (µm)
LAM_MIN, LAM_MAX = 0.10, 2.50

fig, ax = plt.subplots(figsize=(5,2))
ax.imshow(plt.imread('espectro.jpg'))
ax.set_axis_off()

# Línea vertical que se moverá
vline = ax.axvline(0, color='white', linewidth=2)
text_det = pn.pane.Markdown("**Gas detectado:** ---", width=260)

# Rangos de absorción ejemplo (µm inicio, µm fin, nombre)
ABSORBERS = [
    (0.30, 0.32, 'O₃'),
    (0.59, 0.60, 'Na'),
    (0.76, 0.77, 'O₂'),
    (1.13, 1.20, 'H₂O'),
]

def detect_gas(lam):
    for lam0, lam1, name in ABSORBERS:
        if lam0 <= lam <= lam1:
            return name
    return '---'

slider = pn.widgets.FloatSlider(name='λ (μm)', start=LAM_MIN, end=LAM_MAX, value=0.55, step=0.001)

# Relación pixeles ↔ µm (suponemos escala lineal horizontal de la imagen)
img_width = plt.imread('espectro.jpg').shape[1]


def _on_slider(event):
    lam = slider.value
    xpixel = (lam - LAM_MIN) / (LAM_MAX - LAM_MIN) * img_width
    vline.set_xdata([xpixel, xpixel])
    text_det.object = f"**Gas detectado:** {detect_gas(lam)}"
    fig.canvas.draw_idle()

slider.param.watch(_on_slider, 'value')

controls = pn.Column(slider, text_det, width=280)
app = pn.Row(pn.pane.Matplotlib(fig, tight=True, sizing_mode='stretch_both'), controls)
app.servable()

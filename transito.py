import numpy as np
import matplotlib.pyplot as plt
import panel as pn

pn.extension()

# Parámetros
R_STAR = 1.0
X_INIT = 0.0
R_PLANET_INIT = 0.15
SLIDER_X_MIN, SLIDER_X_MAX = -1.2, 1.2
SLIDER_R_MIN, SLIDER_R_MAX = 0.05, 0.35

fig, ax = plt.subplots(figsize=(4,4))
star   = plt.Circle((0,0), R_STAR,  color='gold')
planet = plt.Circle((X_INIT,0), R_PLANET_INIT, color='black')
ax.add_patch(star)
ax.add_patch(planet)
ax.set_aspect('equal')
ax.set_xlim(-1.5,1.5)
ax.set_ylim(-1.5,1.5)
ax.axis('off')

# Sliders Panel
sl_x = pn.widgets.FloatSlider(name='Posición X (R*)', start=SLIDER_X_MIN, end=SLIDER_X_MAX, value=X_INIT, step=0.01)
sl_r = pn.widgets.FloatSlider(name='Radio planeta (R*)', start=SLIDER_R_MIN, end=SLIDER_R_MAX, value=R_PLANET_INIT, step=0.005)

def _update(event=None):
    planet.center = (sl_x.value, 0)
    planet.radius = sl_r.value
    fig.canvas.draw_idle()

sl_x.param.watch(_update, 'value')
sl_r.param.watch(_update, 'value')

controls = pn.Column(sl_x, sl_r, width=280)
app = pn.Row(pn.pane.Matplotlib(fig, tight=True, sizing_mode='stretch_both'), controls)
app.servable()

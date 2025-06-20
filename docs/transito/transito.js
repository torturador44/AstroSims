importScripts("https://cdn.jsdelivr.net/pyodide/v0.27.5/full/pyodide.js");

function sendPatch(patch, buffers, msg_id) {
  self.postMessage({
    type: 'patch',
    patch: patch,
    buffers: buffers
  })
}

async function startApplication() {
  console.log("Loading pyodide!");
  self.postMessage({type: 'status', msg: 'Loading pyodide'})
  self.pyodide = await loadPyodide();
  self.pyodide.globals.set("sendPatch", sendPatch);
  console.log("Loaded!");
  await self.pyodide.loadPackage("micropip");
  const env_spec = ['https://cdn.holoviz.org/panel/wheels/bokeh-3.7.3-py3-none-any.whl', 'https://cdn.holoviz.org/panel/1.7.1/dist/wheels/panel-1.7.1-py3-none-any.whl', 'pyodide-http==0.2.1', 'matplotlib', 'numpy']
  for (const pkg of env_spec) {
    let pkg_name;
    if (pkg.endsWith('.whl')) {
      pkg_name = pkg.split('/').slice(-1)[0].split('-')[0]
    } else {
      pkg_name = pkg
    }
    self.postMessage({type: 'status', msg: `Installing ${pkg_name}`})
    try {
      await self.pyodide.runPythonAsync(`
        import micropip
        await micropip.install('${pkg}');
      `);
    } catch(e) {
      console.log(e)
      self.postMessage({
	type: 'status',
	msg: `Error while installing ${pkg_name}`
      });
    }
  }
  console.log("Packages loaded!");
  self.postMessage({type: 'status', msg: 'Executing code'})
  const code = `
  \nimport asyncio\n\nfrom panel.io.pyodide import init_doc, write_doc\n\ninit_doc()\n\n# -*- coding: utf-8 -*-\n"""\nTr\xe1nsito exoplanetario \u2014 versi\xf3n Panel/Pyodide\n================================================\nEsta versi\xf3n est\xe1 preparada para:\n\u2022 Desarrollo local con \`panel serve transito.py\`\n\u2022 Exportaci\xf3n a HTML autosuficiente con \`panel convert transito.py --to pyodide-worker\`\n"""\n\nimport numpy as np\nimport matplotlib.pyplot as plt\nfrom matplotlib.widgets import Slider\nfrom matplotlib.patches import Circle\nimport panel as pn\n\npn.extension('matplotlib')\n\n# --- Par\xe1metros iniciales ---\nR_STAR = 1.0\nR_PLANET_INIT = 0.1\nX_INIT = -2.0\n\n# --- Colores ---\nCOLOR_STAR = 'gold'\nCOLOR_PLANET = 'black'\nCOLOR_CURVE = 'red'\nCOLOR_POINT = 'dodgerblue'\nBACKGROUND_COLOR = 'black'\nTEXT_COLOR = 'white'\n\n# --- Sliders rango ---\nSLIDER_X_MIN, SLIDER_X_MAX = -3.0, 3.0\nSLIDER_R_MIN, SLIDER_R_MAX = 0.01, R_STAR\n\n# --- Flujo ---\n\ndef calcular_flujo_vectorizado(x_arr, R_p, R_s):\n    r = np.abs(x_arr)\n    flux = np.ones_like(r)\n    A_s = np.pi * R_s ** 2\n    mask_full = r <= np.abs(R_s - R_p)\n    if np.any(mask_full & (R_p <= R_s)):\n        flux[mask_full & (R_p <= R_s)] = 1 - (np.pi * R_p ** 2) / A_s\n    if np.any(mask_full & (R_s < R_p)):\n        flux[mask_full & (R_s < R_p)] = 1 - (np.pi * R_s ** 2) / A_s\n    mask_part = (r < (R_s + R_p)) & (r > np.abs(R_s - R_p))\n    if np.any(mask_part):\n        rp = r[mask_part]\n        arg1 = np.clip((rp ** 2 + R_p ** 2 - R_s ** 2) / (2 * rp * R_p), -1, 1)\n        arg2 = np.clip((rp ** 2 + R_s ** 2 - R_p ** 2) / (2 * rp * R_s), -1, 1)\n        part1 = R_p ** 2 * np.arccos(arg1)\n        part2 = R_s ** 2 * np.arccos(arg2)\n        part3 = 0.5 * np.sqrt(np.maximum(0, (-rp + R_p + R_s) * (rp + R_p - R_s) * (rp - R_p + R_s) * (rp + R_p + R_s)))\n        overlap = part1 + part2 - part3\n        flux[mask_part] = 1 - overlap / A_s\n    return flux\n\n# --- Figura ---\nfig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 6))\nfig.patch.set_facecolor(BACKGROUND_COLOR)\nplt.subplots_adjust(left=0.1, right=0.9, top=0.9, bottom=0.35)\n\n# --- Panel sistema con estrellas ---\nax1.set_aspect('equal')\nax1.set_facecolor(BACKGROUND_COLOR)\nax1.set_xlim(-2 * R_STAR, 2 * R_STAR)\nax1.set_ylim(-1.5 * R_STAR, 1.5 * R_STAR)\nax1.set_title('Sistema Estrella\u2011Planeta', color=TEXT_COLOR)\nax1.set_xlabel('Posici\xf3n X (R*)', color=TEXT_COLOR)\nax1.set_ylabel('Posici\xf3n Y (R*)', color=TEXT_COLOR)\n\n# Cielo estrellado (200 puntos)\nN_STARS = 200\nstar_x = np.random.uniform(-2 * R_STAR, 2 * R_STAR, N_STARS)\nstar_y = np.random.uniform(-1.5 * R_STAR, 1.5 * R_STAR, N_STARS)\nax1.scatter(star_x, star_y, s=2, color='white', alpha=0.8, linewidths=0)\n\nestrella = Circle((0, 0), R_STAR, color=COLOR_STAR, zorder=1)\nax1.add_patch(estrella)\nplaneta = Circle((X_INIT, 0), R_PLANET_INIT, color=COLOR_PLANET, zorder=2)\nax1.add_patch(planeta)\n\n# --- Panel curva de luz ---\nxs = np.linspace(SLIDER_X_MIN, SLIDER_X_MAX, 500)\nflux_init = calcular_flujo_vectorizado(xs, R_PLANET_INIT, R_STAR)\ncurva, = ax2.plot(xs, flux_init, color=COLOR_CURVE, lw=2)\npt, = ax2.plot([X_INIT], [calcular_flujo_vectorizado(np.array([X_INIT]), R_PLANET_INIT, R_STAR)], 'o',\n               color=COLOR_POINT, ms=8)\nax2.set_facecolor(BACKGROUND_COLOR)\nax2.set_title('Curva de luz del tr\xe1nsito', color=TEXT_COLOR)\nax2.set_xlabel('Posici\xf3n X del planeta (R*)', color=TEXT_COLOR)\nax2.set_ylabel('Flujo observado', color=TEXT_COLOR)\nax2.tick_params(colors=TEXT_COLOR)\nax2.grid(ls='--', alpha=0.3, color='gray')\n\n# Ajuste din\xe1mico eje Y\n\ndef upd_ylim(Rp):\n    min_f = 1 - (np.pi * Rp ** 2) / (np.pi * R_STAR ** 2)\n    ax2.set_ylim(min(min_f, 0.98) - 0.01, 1.005)\n\nupd_ylim(R_PLANET_INIT)\n\n# --- Sliders ---\nax_sx = plt.axes([0.25, 0.2, 0.5, 0.03], facecolor='#333')\nsl_x = Slider(ax_sx, 'Posici\xf3n horizontal del planeta (R*)', SLIDER_X_MIN, SLIDER_X_MAX,\n              valinit=X_INIT, color='#1e90ff')\nsl_x.label.set_color(TEXT_COLOR); sl_x.valtext.set_color(TEXT_COLOR)\n\nax_sr = plt.axes([0.25, 0.15, 0.5, 0.03], facecolor='#333')\nsl_r = Slider(ax_sr, 'Radio del planeta (R*)', SLIDER_R_MIN, SLIDER_R_MAX,\n              valinit=R_PLANET_INIT, color='#1e90ff')\nsl_r.label.set_color(TEXT_COLOR); sl_r.valtext.set_color(TEXT_COLOR)\n\n# --- Callback ---\n\ndef actualizar(_):\n    x = sl_x.val; Rp = sl_r.val\n    planeta.center = (x, 0); planeta.set_radius(Rp)\n    pt.set_data([x], [calcular_flujo_vectorizado(np.array([x]), Rp, R_STAR)])\n    curva.set_ydata(calcular_flujo_vectorizado(xs, Rp, R_STAR))\n    upd_ylim(Rp)\n    fig.canvas.draw_idle()\n\nsl_x.on_changed(actualizar)\nsl_r.on_changed(actualizar)\n\n# ------------------- Panel wrapper -------------------\napp = pn.Column(pn.pane.Matplotlib(fig, tight=True, sizing_mode='stretch_both'))\napp.servable()\n\n\nawait write_doc()
  `

  try {
    const [docs_json, render_items, root_ids] = await self.pyodide.runPythonAsync(code)
    self.postMessage({
      type: 'render',
      docs_json: docs_json,
      render_items: render_items,
      root_ids: root_ids
    })
  } catch(e) {
    const traceback = `${e}`
    const tblines = traceback.split('\n')
    self.postMessage({
      type: 'status',
      msg: tblines[tblines.length-2]
    });
    throw e
  }
}

self.onmessage = async (event) => {
  const msg = event.data
  if (msg.type === 'rendered') {
    self.pyodide.runPythonAsync(`
    from panel.io.state import state
    from panel.io.pyodide import _link_docs_worker

    _link_docs_worker(state.curdoc, sendPatch, setter='js')
    `)
  } else if (msg.type === 'patch') {
    self.pyodide.globals.set('patch', msg.patch)
    self.pyodide.runPythonAsync(`
    from panel.io.pyodide import _convert_json_patch
    state.curdoc.apply_json_patch(_convert_json_patch(patch), setter='js')
    `)
    self.postMessage({type: 'idle'})
  } else if (msg.type === 'location') {
    self.pyodide.globals.set('location', msg.location)
    self.pyodide.runPythonAsync(`
    import json
    from panel.io.state import state
    from panel.util import edit_readonly
    if state.location:
        loc_data = json.loads(location)
        with edit_readonly(state.location):
            state.location.param.update({
                k: v for k, v in loc_data.items() if k in state.location.param
            })
    `)
  }
}

startApplication()
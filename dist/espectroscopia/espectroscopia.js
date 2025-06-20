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
  \nimport asyncio\n\nfrom panel.io.pyodide import init_doc, write_doc\n\ninit_doc()\n\n# -*- coding: utf-8 -*-\nfrom __future__ import annotations\nimport numpy as np\nimport matplotlib.pyplot as plt\nfrom matplotlib.widgets import Slider\nfrom matplotlib.animation import FuncAnimation\nimport matplotlib.image as mpimg\nimport os\nimport panel as pn\n\n# ------------------- Cargar y rotar 180\xb0 la imagen del espectro ------------\nIMG_FILE = r"C:\\Users\\diego\\OneDrive\\Escritorio\\AstroSims\\espectro.jpg" # copia la imagen junto al .py o ajusta ruta\nif not os.path.isfile(IMG_FILE):\n    raise FileNotFoundError(f'Falta {IMG_FILE}.')\n\nspectrum_img = np.rot90(mpimg.imread(IMG_FILE), 2)\n\n# ------------------- Datos espectrosc\xf3picos (\u03bcm) ---------------------------\nABSORPTION_LINES: dict[str, list[float]] = {\n    'O\u2082':  [0.245, 0.630, 0.760],\n    'O\u2083':  [0.255],\n    'Na':  [0.589],\n    'K':   [0.770],\n    'H\u2082O': [0.94, 1.13, 1.40, 1.90, 2.70],\n    'CH\u2084': [1.70, 2.30, 3.30],\n    'CO\u2082': [1.44, 1.60, 2.00, 4.26],\n    'CO':  [2.35, 4.60],\n    'N\u2082O': [4.50],\n}\nPEAK_WIDTH = 0.03\n\nLAM_MIN, LAM_MAX = 0.38, 0.75  # rango visible en \u03bcm\n\n# -------------------- Funciones cient\xedficas y utilidades -------------------\n\ndef absorption_strength(lam: float) -> float:\n    return sum(np.exp(-0.5 * ((lam - c) / PEAK_WIDTH) ** 2)\n               for cs in ABSORPTION_LINES.values() for c in cs)\n\n_lams = np.linspace(0.2, 5.0, 3000)\n_MAX_STRENGTH = max(absorption_strength(l) for l in _lams)\nAMP_MIN, AMP_MAX = 0.005, 0.12\namp_from_lambda = lambda lam: AMP_MIN + (AMP_MAX - AMP_MIN) * (absorption_strength(lam) / _MAX_STRENGTH)\ncurrent_absorbers = lambda lam, tol=0.04: [g for g, cs in ABSORPTION_LINES.items() if any(abs(lam-c) < tol for c in cs)]\n\ndef wavelength_to_rgb(lmbd: float):\n    t = (lmbd - 0.38) / (0.75 - 0.38)\n    t = np.clip(t, 0, 1)\n    return (t, max(0, 1 - 4 * abs(t - 0.5)), 1 - t)\n\n# ------------------- Par\xe1metros de animaci\xf3n ------------------------------\nN_MOLECULES = 50          # <- m\xe1s part\xedculas\nCELL_SIZE   = 1.0\nINTERVAL_MS = 16          # <- ~60 fps\nnp.random.seed(2)\n\n# ------------------------ Construcci\xf3n de la interfaz ----------------------\nfig = plt.figure(figsize=(11, 4))\nplt.subplots_adjust(left=0.05, right=0.97, top=0.9, bottom=0.18)\nfig.patch.set_facecolor('black')\nfig.canvas.manager.set_window_title('Simulador de Espectroscop\xeda')\n\nax_spec = plt.axes([0.06, 0.35, 0.40, 0.55], facecolor='black')\nax_spec.imshow(spectrum_img, extent=[LAM_MIN, LAM_MAX, 0, 1], aspect='auto')\nax_spec.set_xlabel('Longitud de onda (\u03bcm)', color='white', fontsize=12)\nax_spec.set_yticks([])\nax_spec.set_title('Espectro visible', color='white', fontsize=12)\nline_lambda = ax_spec.axvline(x=0.55, color='white', linestyle='--', linewidth=2)\n\nax_slider = plt.axes([0.06, 0.20, 0.40, 0.05], facecolor='#222')\nslider = Slider(ax_slider, label='\u03bb (\u03bcm)', valmin=LAM_MIN, valmax=LAM_MAX,\n                valinit=0.55, valstep=0.001, color='#00e0ff')\nslider.label.set_color('white'); slider.valtext.set_color('white')\n\nax_text = plt.axes([0.06, 0.05, 0.40, 0.08]); ax_text.axis('off')\ntext_detection = ax_text.text(0.5, 0.5, '', ha='center', va='center', fontsize=12, color='white', wrap=True)\n\nax_cell = plt.axes([0.50, 0.10, 0.45, 0.80], facecolor='black')\nax_cell.set_xlim(0, CELL_SIZE); ax_cell.set_ylim(0, CELL_SIZE)\nax_cell.set_aspect('equal'); ax_cell.set_xticks([]); ax_cell.set_yticks([])\nax_cell.set_title('Mol\xe9culas en la atm\xf3sfera', color='white', fontsize=12)\n\nbase_pos = np.random.rand(N_MOLECULES, 2) * CELL_SIZE\nscatter = ax_cell.scatter(base_pos[:, 0], base_pos[:, 1], s=60,\n                          c='#ffd65a', edgecolors='#ff9f40')\ncurrent_lambda = slider.val\n\n# ----------------------- Callbacks y animaci\xf3n ----------------------------\n\ndef on_slider(val):\n    global current_lambda\n    current_lambda = val\n    line_lambda.set_xdata([val, val]); line_lambda.set_color(wavelength_to_rgb(val))\n    gases = current_absorbers(val)\n    text_detection.set_text('Absorben: ' + ', '.join(gases) if gases else 'Sin absorci\xf3n fuerte')\n    fig.canvas.draw_idle()\n\nslider.on_changed(on_slider)\n\ndef animate(_):\n    amp = amp_from_lambda(current_lambda)\n    jitter = np.random.uniform(-amp, amp, base_pos.shape)\n    scatter.set_offsets(np.clip(base_pos + jitter, 0, CELL_SIZE))\n    return scatter,\n\nani = FuncAnimation(fig, animate, interval=INTERVAL_MS, blit=True, cache_frame_data=False)\n\non_slider(current_lambda)\n\npn.extension()\n\napp = pn.Column(pn.pane.Matplotlib(fig, tight=True, sizing_mode='stretch_both'))\napp.servable()\n\nawait write_doc()
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
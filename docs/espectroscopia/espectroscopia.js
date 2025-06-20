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
  \nimport asyncio\n\nfrom panel.io.pyodide import init_doc, write_doc\n\ninit_doc()\n\nimport numpy as np\nimport matplotlib.pyplot as plt\nimport panel as pn\n\npn.extension()\n\n# Rango de longitudes de onda (\xb5m)\nLAM_MIN, LAM_MAX = 0.10, 2.50\n\nfig, ax = plt.subplots(figsize=(5,2))\nax.imshow(plt.imread('espectro.jpg'))\nax.set_axis_off()\n\n# L\xednea vertical que se mover\xe1\nvline = ax.axvline(0, color='white', linewidth=2)\ntext_det = pn.pane.Markdown("**Gas detectado:** ---", width=260)\n\n# Rangos de absorci\xf3n ejemplo (\xb5m inicio, \xb5m fin, nombre)\nABSORBERS = [\n    (0.30, 0.32, 'O\u2083'),\n    (0.59, 0.60, 'Na'),\n    (0.76, 0.77, 'O\u2082'),\n    (1.13, 1.20, 'H\u2082O'),\n]\n\ndef detect_gas(lam):\n    for lam0, lam1, name in ABSORBERS:\n        if lam0 <= lam <= lam1:\n            return name\n    return '---'\n\nslider = pn.widgets.FloatSlider(name='\u03bb (\u03bcm)', start=LAM_MIN, end=LAM_MAX, value=0.55, step=0.001)\n\n# Relaci\xf3n pixeles \u2194 \xb5m (suponemos escala lineal horizontal de la imagen)\nimg_width = plt.imread('espectro.jpg').shape[1]\n\n\ndef _on_slider(event):\n    lam = slider.value\n    xpixel = (lam - LAM_MIN) / (LAM_MAX - LAM_MIN) * img_width\n    vline.set_xdata([xpixel, xpixel])\n    text_det.object = f"**Gas detectado:** {detect_gas(lam)}"\n    fig.canvas.draw_idle()\n\nslider.param.watch(_on_slider, 'value')\n\ncontrols = pn.Column(slider, text_det, width=280)\napp = pn.Row(pn.pane.Matplotlib(fig, tight=True, sizing_mode='stretch_both'), controls)\napp.servable()\n\n\nawait write_doc()
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
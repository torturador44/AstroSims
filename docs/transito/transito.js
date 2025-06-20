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
  \nimport asyncio\n\nfrom panel.io.pyodide import init_doc, write_doc\n\ninit_doc()\n\nimport numpy as np\nimport matplotlib.pyplot as plt\nimport panel as pn\n\npn.extension()\n\n# Par\xe1metros\nR_STAR = 1.0\nX_INIT = 0.0\nR_PLANET_INIT = 0.15\nSLIDER_X_MIN, SLIDER_X_MAX = -1.2, 1.2\nSLIDER_R_MIN, SLIDER_R_MAX = 0.05, 0.35\n\nfig, ax = plt.subplots(figsize=(4,4))\nstar   = plt.Circle((0,0), R_STAR,  color='gold')\nplanet = plt.Circle((X_INIT,0), R_PLANET_INIT, color='black')\nax.add_patch(star)\nax.add_patch(planet)\nax.set_aspect('equal')\nax.set_xlim(-1.5,1.5)\nax.set_ylim(-1.5,1.5)\nax.axis('off')\n\n# Sliders Panel\nsl_x = pn.widgets.FloatSlider(name='Posici\xf3n X (R*)', start=SLIDER_X_MIN, end=SLIDER_X_MAX, value=X_INIT, step=0.01)\nsl_r = pn.widgets.FloatSlider(name='Radio planeta (R*)', start=SLIDER_R_MIN, end=SLIDER_R_MAX, value=R_PLANET_INIT, step=0.005)\n\ndef _update(event=None):\n    planet.center = (sl_x.value, 0)\n    planet.radius = sl_r.value\n    fig.canvas.draw_idle()\n\nsl_x.param.watch(_update, 'value')\nsl_r.param.watch(_update, 'value')\n\ncontrols = pn.Column(sl_x, sl_r, width=280)\napp = pn.Row(pn.pane.Matplotlib(fig, tight=True, sizing_mode='stretch_both'), controls)\napp.servable()\n\n\nawait write_doc()
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
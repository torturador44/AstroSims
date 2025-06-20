import panel as pn

pn.extension()

titulo = pn.pane.Markdown("# AstroSim\nElige un simulador", styles={'color': 'white'})
btn_transit = pn.widgets.Button(name="Simular Tránsito", width=220)
btn_spectro = pn.widgets.Button(name="Simular Espectroscopia", width=220)

btn_transit.js_on_click(code="window.location.href='transito/';")
btn_spectro.js_on_click(code="window.location.href='espectroscopia/';")

menu = pn.Column(
    titulo, pn.Spacer(height=20), btn_transit, btn_spectro,
    styles={'background': 'black', 'padding': '60px', 'text-align': 'center'},
    sizing_mode='stretch_width',
)

menu.servable()

cd "$(dirname "$0")"
{ cat page_head.html; cat page_body.html; printf '<script type="application/json" id="researchData">'; cat research.json; printf '</script>\n<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>\n<script>\n'; cat page_app.js; printf '</script>\n<script>\n'; cat page_3d.js; printf '</script>\n<script type="application/json" id="ala2Data">'; cat ala2_backtest.json; printf '</script>\n<script>\n'; cat page_ala2.js; printf '</script>\n'; } > mesa_radar.html
wc -c mesa_radar.html

/**
 * VenusP Valve Viewer — landmarks, technical mesh, MPA segment phase model, Three.js 3D
 * Requires: THREE (global), drawRVOTCanvas integration hooks
 */
(function (global) {
    'use strict';

    var SEG_A_SYSTOLE = -0.035;
    var SEG_A_DIASTOLE = 0.035;
    var SEG_B_SYSTOLE = 0.045;
    var SEG_B_DIASTOLE = -0.045;
    var ST_JUNCTION_MM = 10;
    var FLARE_IN_MM = 12;
    var FLARE_OUT_MM = 17;

    global.valveViewerState = {
        landmark: 'annulus',
        offsetMm: 0
    };

    var threeState = {
        inited: false,
        renderer: null,
        scene: null,
        camera: null,
        stentGroup: null,
        anatomyGroup: null,
        dragging: false,
        lastX: 0,
        lastY: 0,
        rotY: 0.4,
        rotX: 0.15,
        animId: null
    };

    function vEl(id) { var e = document.getElementById(id); return e ? e.value : ''; }

    function readViewerStateFromUI() {
        global.valveViewerState.landmark = vEl('in-landmark') || 'annulus';
        global.valveViewerState.offsetMm = parseFloat(vEl('in-valve-offset')) || 0;
        var lbl = document.getElementById('valve-offset-label');
        if (lbl) lbl.textContent = (global.valveViewerState.offsetMm > 0 ? '+' : '') + global.valveViewerState.offsetMm.toFixed(1) + ' mm';
    }

    function suggestLandmarkFromMorph(morphKey) {
        if (morphKey === 'type1') return 'bifurcation';
        return 'annulus';
    }

    function syncLandmarkSuggestion(morphKey) {
        var sel = document.getElementById('in-landmark');
        if (!sel || sel.dataset.userSet === '1') return;
        var suggested = suggestLandmarkFromMorph(morphKey);
        sel.value = suggested;
        global.valveViewerState.landmark = suggested;
    }

    function getStJunctionDist(planes) {
        for (var i = 0; i < planes.length; i++) {
            var n = (planes[i].name || '').toLowerCase();
            if (n.indexOf('mid') !== -1 || n.indexOf('st') !== -1) return planes[i].dist;
        }
        return ST_JUNCTION_MM;
    }

    function getBifurcationDist(planes) {
        var max = 30;
        for (var i = 0; i < planes.length; i++) {
            var n = (planes[i].name || '').toLowerCase();
            if (n.indexOf('bifur') !== -1) return planes[i].dist;
            if (planes[i].dist > max) max = planes[i].dist;
        }
        return max;
    }

    function getPhaseAdjustedDist(dist, phase, stJ, bifDist) {
        if (dist <= stJ) {
            var f = phase === 'systole' ? SEG_A_SYSTOLE : SEG_A_DIASTOLE;
            return dist * (1 + f);
        }
        if (dist <= bifDist) {
            var g = phase === 'systole' ? SEG_B_SYSTOLE : SEG_B_DIASTOLE;
            return dist * (1 + g);
        }
        return dist;
    }

    global.getPhaseAdjustedPlaneGeometry = function (tablePlanes, phase, scale, baseY) {
        var stJ = getStJunctionDist(tablePlanes);
        var bif = getBifurcationDist(tablePlanes);
        var yLevels = [];
        var radii = [];
        for (var i = 0; i < tablePlanes.length; i++) {
            var p = tablePlanes[i];
            var adjDist = getPhaseAdjustedDist(p.dist, phase, stJ, bif);
            yLevels.push(baseY - (adjDist * scale));
            var pref = phase === 'systole' ? 's' : 'd';
            radii.push(((p[pref + '1'] + p[pref + '2']) / 2 * scale) / 2);
        }
        return { yLevels: yLevels, radii: radii, stJ: stJ, bif: bif };
    };

    global.getLandmarkAnchorDist = function (tablePlanes, landmark) {
        var idxValvar = tablePlanes.findIndex(function (p) { return p.id === 'valvar'; });
        var valvarDist = idxValvar >= 0 ? tablePlanes[idxValvar].dist : 0;
        var stJ = getStJunctionDist(tablePlanes);
        var bif = getBifurcationDist(tablePlanes);
        switch (landmark) {
            case 'trans_annular': return valvarDist + 3;
            case 'st_junction': return stJ;
            case 'bifurcation': return bif;
            case 'annulus':
            default: return valvarDist;
        }
    };

    global.computeValveVerticalLayout = function (anchorY, scale, straightOD, stentLenVal, totalLenDrawing) {
        var pxStentLen = stentLenVal * scale;
        var pxFlareIn = FLARE_IN_MM * scale;
        var pxFlareOut = FLARE_OUT_MM * scale;
        var radStraight = (straightOD * scale) / 2;
        var radFlare = ((straightOD + 10) * scale) / 2;
        var yOutflowTop = anchorY;
        var yStraightTop = yOutflowTop + pxFlareOut;
        var yStraightBottom = yStraightTop + pxStentLen;
        var yInflowBottom = yStraightBottom + pxFlareIn;
        return {
            yOutflowTop: yOutflowTop,
            yStraightTop: yStraightTop,
            yStraightBottom: yStraightBottom,
            yInflowBottom: yInflowBottom,
            radStraight: radStraight,
            radFlare: radFlare,
            pxFlareIn: pxFlareIn,
            pxFlareOut: pxFlareOut,
            pxStentLen: pxStentLen,
            totalLenDrawing: totalLenDrawing
        };
    };

    function clipDiamondMesh(ctx, drawFn) {
        ctx.save();
        drawFn();
        ctx.restore();
    }

    global.drawTechnicalStentMesh = function (ctx, centerX, layout, view) {
        var y0 = layout.yOutflowTop;
        var y1 = layout.yInflowBottom;
        var rs = layout.radStraight;
        var rf = layout.radFlare;
        var alpha = view === 'valve' ? 0.55 : 0.42;

        ctx.save();
        ctx.beginPath();
        global.drawValvePath(ctx, centerX, rs, rf, layout.yStraightTop, layout.yStraightBottom, layout.yOutflowTop, layout.yInflowBottom, layout.pxFlareOut);
        ctx.clip();

        ctx.strokeStyle = 'rgba(23, 20, 52, 0.85)';
        ctx.lineWidth = 0.9;
        var cell = 11;
        for (var y = y0 - 15; y < y1 + 15; y += cell) {
            for (var x = centerX - rf - 25; x < centerX + rf + 25; x += cell) {
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x + cell, y + cell);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(x + cell, y);
                ctx.lineTo(x, y + cell);
                ctx.stroke();
            }
        }
        ctx.restore();

        ctx.save();
        ctx.beginPath();
        global.drawValvePath(ctx, centerX, rs, rf, layout.yStraightTop, layout.yStraightBottom, layout.yOutflowTop, layout.yInflowBottom, layout.pxFlareOut);
        ctx.fillStyle = view === 'valve' ? 'rgba(230, 138, 46, ' + alpha + ')' : 'rgba(230, 138, 46, ' + (alpha - 0.1) + ')';
        ctx.fill();
        ctx.strokeStyle = '#171434';
        ctx.lineWidth = view === 'valve' ? 2.2 : 1.8;
        ctx.stroke();
        ctx.restore();

        if (view === 'deploy') {
            ctx.save();
            ctx.strokeStyle = 'rgba(16, 185, 129, 0.9)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([5, 4]);
            var yMid = (layout.yStraightTop + layout.yStraightBottom) / 2;
            ctx.beginPath();
            ctx.moveTo(centerX - rs - 20, yMid);
            ctx.lineTo(centerX + rs + 20, yMid);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
        }
    };

    global.drawPhuocValveLabels = function (ctx, centerX, layout, straightOD, stentLenVal, totalLenText) {
        var d1 = straightOD + 10;
        var d2 = straightOD;
        var d3 = straightOD + 10;
        var l1 = FLARE_OUT_MM;
        var l2 = stentLenVal;
        var l3 = FLARE_IN_MM;
        global.drawHorizontalCaliperLeft(ctx, centerX - layout.radFlare - 12, layout.yOutflowTop, 'D1 proximal: ' + d1 + ' mm', '#171434');
        global.drawHorizontalCaliperLeft(ctx, centerX - layout.radStraight - 12, (layout.yStraightTop + layout.yStraightBottom) / 2, 'D2 waist: ' + d2 + ' mm', '#302B6A');
        global.drawHorizontalCaliperLeft(ctx, centerX - layout.radFlare - 12, layout.yInflowBottom, 'D3 distal: ' + d3 + ' mm', '#171434');
        global.drawVerticalCaliper(ctx, centerX + layout.radStraight + 28, layout.yOutflowTop, layout.yStraightTop, 'L1: ' + l1 + ' mm', '#D97706');
        global.drawVerticalCaliper(ctx, centerX + layout.radStraight + 55, layout.yStraightTop, layout.yStraightBottom, 'L2: ' + l2 + ' mm', '#171434');
        global.drawVerticalCaliper(ctx, centerX + layout.radFlare + 75, layout.yStraightBottom, layout.yInflowBottom, 'L3: ' + l3 + ' mm', '#D97706');
        global.drawVerticalCaliper(ctx, centerX + layout.radFlare + 105, layout.yOutflowTop, layout.yInflowBottom, 'E: ' + totalLenText, '#6448FC');
    };

    function buildStentMesh3D(straightOD, stentLen) {
        var group = new THREE.Group();
        var rW = straightOD / 2;
        var rF = (straightOD + 10) / 2;
        var segs = 48;
        var rings = 28;
        var totalH = FLARE_OUT_MM + stentLen + FLARE_IN_MM;
        var mat = new THREE.LineBasicMaterial({ color: 0xe68a2e, transparent: true, opacity: 0.95 });
        var matDark = new THREE.LineBasicMaterial({ color: 0x171434, transparent: true, opacity: 0.7 });

        function radiusAt(t) {
            var h = t * totalH;
            if (h < FLARE_OUT_MM) {
                var u = h / FLARE_OUT_MM;
                return rF - (rF - rW) * (u * u);
            }
            if (h < FLARE_OUT_MM + stentLen) return rW;
            var v = (h - FLARE_OUT_MM - stentLen) / FLARE_IN_MM;
            return rW + (rF - rW) * (v * v);
        }

        for (var ri = 0; ri <= rings; ri++) {
            var t = ri / rings;
            var y = (t - 0.5) * totalH * 0.12;
            var r = radiusAt(t) * 0.12;
            var ringGeo = new THREE.BufferGeometry();
            var pts = [];
            for (var si = 0; si <= segs; si++) {
                var a = (si / segs) * Math.PI * 2;
                pts.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
            }
            ringGeo.setFromPoints(pts);
            group.add(new THREE.Line(ringGeo, ri % 3 === 0 ? matDark : mat));
        }

        for (var si = 0; si < segs; si += 2) {
            var a = (si / segs) * Math.PI * 2;
            var vertPts = [];
            for (var ri2 = 0; ri2 <= rings; ri2++) {
                var t2 = ri2 / rings;
                var y2 = (t2 - 0.5) * totalH * 0.12;
                var r2 = radiusAt(t2) * 0.12;
                vertPts.push(new THREE.Vector3(Math.cos(a) * r2, y2, Math.sin(a) * r2));
            }
            var vGeo = new THREE.BufferGeometry().setFromPoints(vertPts);
            group.add(new THREE.Line(vGeo, mat));
        }

        var diagMat = new THREE.LineBasicMaterial({ color: 0x302b6a, transparent: true, opacity: 0.35 });
        for (var di = 0; di < segs; di += 4) {
            for (var dj = 0; dj < rings; dj += 2) {
                var tA = dj / rings, tB = (dj + 2) / rings;
                var a1 = (di / segs) * Math.PI * 2;
                var a2 = ((di + 2) / segs) * Math.PI * 2;
                var yA = (tA - 0.5) * totalH * 0.12;
                var yB = (tB - 0.5) * totalH * 0.12;
                var rA = radiusAt(tA) * 0.12;
                var rB = radiusAt(tB) * 0.12;
                var dGeo = new THREE.BufferGeometry().setFromPoints([
                    new THREE.Vector3(Math.cos(a1) * rA, yA, Math.sin(a1) * rA),
                    new THREE.Vector3(Math.cos(a2) * rB, yB, Math.sin(a2) * rB)
                ]);
                group.add(new THREE.Line(dGeo, diagMat));
            }
        }

        return group;
    }

    function buildAnatomyTube3D(planes, phase) {
        var group = new THREE.Group();
        var mat = new THREE.LineBasicMaterial({ color: 0x9ca3af, transparent: true, opacity: 0.45 });
        var pref = phase === 'systole' ? 's' : 'd';
        var stJ = getStJunctionDist(planes);
        var bif = getBifurcationDist(planes);
        var pts = [];
        for (var i = 0; i < planes.length; i++) {
            var p = planes[i];
            var adj = getPhaseAdjustedDist(p.dist, phase, stJ, bif);
            var r = ((p[pref + '1'] + p[pref + '2']) / 2) * 0.006;
            pts.push(new THREE.Vector3(r, -adj * 0.012, 0));
            pts.push(new THREE.Vector3(-r, -adj * 0.012, 0));
        }
        if (pts.length >= 2) {
            var g = new THREE.BufferGeometry().setFromPoints(pts);
            group.add(new THREE.Line(g, mat));
        }
        return group;
    }

    global.initValve3DViewer = function () {
        if (typeof THREE === 'undefined') return;
        var container = document.getElementById('valve3d-container');
        if (!container || threeState.inited) return;

        var w = container.clientWidth || 740;
        var h = 600;
        threeState.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        threeState.renderer.setSize(w, h);
        threeState.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(threeState.renderer.domElement);

        threeState.scene = new THREE.Scene();
        threeState.scene.background = new THREE.Color(0xf8f9fa);
        threeState.camera = new THREE.PerspectiveCamera(42, w / h, 0.01, 100);
        threeState.camera.position.set(0.35, 0.12, 1.4);

        threeState.scene.add(new THREE.AmbientLight(0xffffff, 0.85));
        var dir = new THREE.DirectionalLight(0xffffff, 0.65);
        dir.position.set(2, 3, 4);
        threeState.scene.add(dir);

        threeState.stentGroup = new THREE.Group();
        threeState.anatomyGroup = new THREE.Group();
        threeState.scene.add(threeState.anatomyGroup);
        threeState.scene.add(threeState.stentGroup);

        var dom = threeState.renderer.domElement;
        dom.addEventListener('mousedown', function (e) {
            threeState.dragging = true;
            threeState.lastX = e.clientX;
            threeState.lastY = e.clientY;
        });
        window.addEventListener('mouseup', function () { threeState.dragging = false; });
        window.addEventListener('mousemove', function (e) {
            if (!threeState.dragging) return;
            threeState.rotY += (e.clientX - threeState.lastX) * 0.008;
            threeState.rotX += (e.clientY - threeState.lastY) * 0.008;
            threeState.rotX = Math.max(-1.2, Math.min(1.2, threeState.rotX));
            threeState.lastX = e.clientX;
            threeState.lastY = e.clientY;
        });

        threeState.inited = true;
    };

    global.updateValve3DViewer = function (sku, tablePlanes, phase, offsetMm) {
        if (typeof THREE === 'undefined') return;
        global.initValve3DViewer();
        if (!threeState.stentGroup) return;

        while (threeState.stentGroup.children.length) {
            threeState.stentGroup.remove(threeState.stentGroup.children[0]);
        }
        while (threeState.anatomyGroup.children.length) {
            threeState.anatomyGroup.remove(threeState.anatomyGroup.children[0]);
        }

        var straightOD = parseInt(sku.split('-')[0].replace('P', ''), 10) || 28;
        var stentLen = parseInt(sku.split('-')[1], 10) || 25;
        var stent = buildStentMesh3D(straightOD, stentLen);
        stent.position.y = -(offsetMm || 0) * 0.012;
        threeState.stentGroup.add(stent);
        threeState.anatomyGroup.add(buildAnatomyTube3D(tablePlanes, phase));

        threeState.stentGroup.rotation.x = threeState.rotX;
        threeState.stentGroup.rotation.y = threeState.rotY;
        threeState.anatomyGroup.rotation.x = threeState.rotX * 0.3;
        threeState.anatomyGroup.rotation.y = threeState.rotY * 0.3;

        if (threeState.animId) cancelAnimationFrame(threeState.animId);
        function tick() {
            threeState.animId = requestAnimationFrame(tick);
            threeState.stentGroup.rotation.y += 0.0015;
            threeState.renderer.render(threeState.scene, threeState.camera);
        }
        tick();
    };

    global.showValve3DPanel = function (show) {
        var c3 = document.getElementById('valve3d-container');
        var cv = document.getElementById('deploymentCanvas');
        if (c3) c3.style.display = show ? 'block' : 'none';
        if (cv) cv.style.display = show ? 'none' : 'block';
    };

    global.captureValve3DImage = function () {
        if (!threeState.renderer) return '';
        try { return threeState.renderer.domElement.toDataURL('image/png'); } catch (e) { return ''; }
    };

    global.onValveViewerUIChange = function () {
        readViewerStateFromUI();
        if (typeof global.updateUI === 'function') global.updateUI();
    };

    global.bindValveViewerUI = function () {
        var sel = document.getElementById('in-landmark');
        if (sel) {
            sel.addEventListener('change', function () {
                sel.dataset.userSet = '1';
                global.onValveViewerUIChange();
            });
        }
        var off = document.getElementById('in-valve-offset');
        if (off) off.addEventListener('input', global.onValveViewerUIChange);
    };

})(typeof window !== 'undefined' ? window : this);

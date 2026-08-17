    var MASTER_PASSWORD = "venus2026";
    var currentCanvasView = 'anatomy'; 
    var activeHighlight = null; 
    var lockedHighlight = null;
    var textHitBoxes = []; 
    
    var storedValve = null;
    var storedVolKey = null;
    var storedData = null;

    var canvasDom = document.getElementById('deploymentCanvas');
    canvasDom.addEventListener('mousemove', function(e) {
        if(textHitBoxes.length === 0) return;
        var rect = canvasDom.getBoundingClientRect();
        var scaleX = canvasDom.width / rect.width;
        var scaleY = canvasDom.height / rect.height;
        var x = (e.clientX - rect.left) * scaleX;
        var y = (e.clientY - rect.top) * scaleY;

        var found = null;
        for(var i = 0; i < textHitBoxes.length; i++) {
            var b = textHitBoxes[i];
            if(x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
                found = b.id; 
                break;
            }
        }
        
        if(found !== activeHighlight) {
            if(found) {
                activeHighlight = found;
                canvasDom.style.cursor = 'pointer';
            } else {
                activeHighlight = lockedHighlight;
                canvasDom.style.cursor = 'default';
            }
            updateHighlightUI(); 
        }
    });

    canvasDom.addEventListener('mouseleave', function() {
        if(activeHighlight !== lockedHighlight) {
            activeHighlight = lockedHighlight;
            canvasDom.style.cursor = 'default';
            updateHighlightUI();
        }
    });

    canvasDom.addEventListener('click', function(e) {
        if(textHitBoxes.length === 0) return;
        var rect = canvasDom.getBoundingClientRect();
        var scaleX = canvasDom.width / rect.width;
        var scaleY = canvasDom.height / rect.height;
        var x = (e.clientX - rect.left) * scaleX;
        var y = (e.clientY - rect.top) * scaleY;

        var found = null;
        for(var i = 0; i < textHitBoxes.length; i++) {
            var b = textHitBoxes[i];
            if(x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
                found = b.id; 
                break;
            }
        }
        
        if(found) {
            toggleHighlight(found);
        } else {
            lockedHighlight = null;
            activeHighlight = null;
            updateHighlightUI();
        }
    });

    window.toggleHighlight = function(id) {
        if (lockedHighlight === id) {
            lockedHighlight = null;
            activeHighlight = null;
        } else {
            lockedHighlight = id;
            activeHighlight = id;
        }
        updateHighlightUI();
    };

    window.setHighlight = function(id) {
        activeHighlight = id;
        updateHighlightUI();
    };

    window.clearHighlight = function() {
        activeHighlight = lockedHighlight;
        updateHighlightUI();
    };

    window.updateHighlightUI = function() {
        drawVitaeInteractiveRendering();
        
        var elements = document.querySelectorAll('.highlight-active, .highlight-locked');
        elements.forEach(function(e) {
            e.classList.remove('highlight-active');
            e.classList.remove('highlight-locked');
        });

        var id = activeHighlight;
        if(id) {
            var isLocked = (id === lockedHighlight);
            var highlightClass = isLocked ? 'highlight-locked' : 'highlight-active';
            
            var applyTo = function(elemId) {
                var el = document.getElementById(elemId);
                if(el) el.classList.add(highlightClass);
            };

            if(id==='annulus') { applyTo('in-area'); applyTo('in-perim'); applyTo('card-res-oversize'); }
            if(id==='sov') { applyTo('in-sov-diam'); }
            if(id==='stj') { applyTo('in-stj-diam'); applyTo('card-res-stj-comp'); }
            if(id==='stjl') { applyTo('in-stjl-height'); applyTo('card-res-stjl'); }
            if(id==='stjr') { applyTo('in-stjr-height'); applyTo('card-res-stjr'); }
            if(id==='asc') { applyTo('in-asc-aorta'); applyTo('in-asc-height'); }
            if(id==='rca') { applyTo('in-rca'); applyTo('card-res-rca'); }
            if(id==='lca') { applyTo('in-lca'); applyTo('card-res-lca'); }
        }
    };

    function setCanvasView(view) {
        currentCanvasView = view;
        activeHighlight = null;
        lockedHighlight = null;
        document.getElementById('tab-anatomy').classList.remove('active');
        document.getElementById('tab-valve').classList.remove('active');
        document.getElementById('tab-clinical').classList.remove('active');
        document.getElementById('tab-' + view).classList.add('active');
        runSizingEngine(); 
    }

    function unlockApp() {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app-content').style.display = 'flex';
        document.body.style.alignItems = 'flex-start';
        try { sessionStorage.setItem('venus_vitae_sizing_ok', '1'); } catch (err) {}
        runSizingEngine();
    }

    function checkPassword(event) {
        event.preventDefault();
        var inputVal = document.getElementById('password-input').value;
        var errorMsg = document.getElementById('error-msg');

        if (inputVal === MASTER_PASSWORD) {
            unlockApp();
        } else {
            errorMsg.style.display = 'block';
            document.getElementById('password-input').value = '';
        }
    }

    function resetFields() {
        var inputs = document.querySelectorAll('input[type="text"], input[type="number"]');
        for (var i = 0; i < inputs.length; i++) {
            inputs[i].value = '';
        }
        document.getElementById('in-pref').value = 'Automatic';
        runSizingEngine();
    }

    function loadDemoCase() {
        document.getElementById('in-name').value = 'Demo Patient';
        document.getElementById('in-pref').value = 'Automatic';
        document.getElementById('in-area').value = '470';
        document.getElementById('in-perim').value = '77';
        document.getElementById('in-calc').value = '350';
        document.getElementById('in-sov-diam').value = '32';
        document.getElementById('in-stjl-height').value = '22';
        document.getElementById('in-stjr-height').value = '21';
        document.getElementById('in-stj-diam').value = '28';
        document.getElementById('in-asc-aorta').value = '32';
        document.getElementById('in-asc-height').value = '40';
        document.getElementById('in-lca').value = '13.5';
        document.getElementById('in-rca').value = '15';
        runSizingEngine();
    }

    function showBrandedAlert(title, message, warningMsg) {
        document.getElementById('alert-title').innerText = title;
        var htmlContent = "<p style='margin-top:0;'>" + message + "</p>";
        if(warningMsg) {
            htmlContent += "<div class='modal-highlight-box'><strong>NOTE:</strong><br>" + warningMsg + "</div>";
        }
        document.getElementById('alert-body').innerHTML = htmlContent;
        document.getElementById('alertModal').style.display = 'flex';
    }

    async function handlePDFUpload(event) {
        var file = event.target.files[0];
        if (!file) return;

        var modal = document.getElementById('loadingModal');
        var fill = document.getElementById('loadingBarFill');
        var percentText = document.getElementById('loadingPercent');
        var statusText = document.getElementById('loading-status-text');

        modal.style.display = 'flex';
        fill.style.width = '10%'; percentText.innerText = '10%';
        statusText.innerText = "Scanning 3mensio matrices...";

        try {
            var arrayBuffer = await file.arrayBuffer();
            fill.style.width = '30%'; percentText.innerText = '30%';

            var loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
            var pdfDoc = await loadingTask.promise;
            
            var rawTextNoSpaces = "";
            var rawTextWithSpaces = "";
            var numPages = pdfDoc.numPages;
            var pagesToOCR = [];

            for (var i = 1; i <= numPages; i++) {
                fill.style.width = Math.min(30 + Math.floor((i / numPages) * 50), 80) + '%';
                percentText.innerText = fill.style.width;

                var page = await pdfDoc.getPage(i);
                var textContent = await page.getTextContent();
                
                var pageStrNoSpaces = textContent.items.map(function(item) { return item.str; }).join("").replace(/\s+/g, '').toLowerCase();
                rawTextNoSpaces += pageStrNoSpaces;
                rawTextWithSpaces += textContent.items.map(function(item) { return item.str; }).join(" ");

                if (pageStrNoSpaces.includes('sinotubularjunction') || pageStrNoSpaces.includes('ascendingaorta') || pageStrNoSpaces.includes('hockeypuck') || pageStrNoSpaces.includes('calcium')) {
                    pagesToOCR.push(i);
                }
            }

            pagesToOCR = [...new Set(pagesToOCR)];

            fill.style.width = '85%'; percentText.innerText = '85%';

            setTimeout(async function() {
                var textLower = rawTextNoSpaces.replace(/\s+/g, '').toLowerCase();
                
                var extract = function(regex) {
                    var match = textLower.match(regex);
                    return match && match[1] ? parseFloat(match[1]) : '';
                };

                var area = extract(/area:([\d\.]+)/);
                var perim = extract(/perimeter:([\d\.]+)/);
                var rca = extract(/rcaheight:([\d\.]+)/);
                var lca = extract(/lcaheight:([\d\.]+)/);
                var ascAorta = extract(/asc\.aorta[^:]*:([\d\.]+)/) || extract(/ascendingaorta.*?average.*?([\d\.]+)/);
                var stjDiam = extract(/stj[^:]*:([\d\.]+)/) || extract(/sinotubularjunction.*?average.*?([\d\.]+)/);

                var sovMean = '';
                var sovMatch = textLower.match(/left:([\d\.]+).*?right:([\d\.]+).*?non:([\d\.]+)/);
                if (sovMatch) {
                    sovMean = ((parseFloat(sovMatch[1]) + parseFloat(sovMatch[2]) + parseFloat(sovMatch[3])) / 3).toFixed(1);
                }

                var patName = file.name.replace('.pdf', '');
                var nameMatch = rawTextWithSpaces.match(/Name:\s*(.*?)\s*Gender/i);
                if (nameMatch && nameMatch[1]) {
                    patName = nameMatch[1].replace(/\s+/g, ' ').replace(/\s([,;])/g, '$1').trim();
                }

                var stjlHeight = extract(/stjl.*?height[^:]*:([\d\.]+)/);
                var stjrHeight = extract(/stjr.*?height[^:]*:([\d\.]+)/);
                var stjFallback = extract(/stjheight[^:]*:([\d\.]+)/) || extract(/sinotubular.*?height.*?([\d\.]+)/);

                var ascAortaHeight = '';
                var calc = extract(/totalcalcium:([\d\.]+)/); 

                if (!calc || !stjlHeight || !stjrHeight || !ascAortaHeight) {
                    statusText.innerText = "Activating Advanced Vision OCR...";
                    var worker = await Tesseract.createWorker('eng');
                    
                    var ocrProgress = 0;
                    for (var pageNum of pagesToOCR) {
                        ocrProgress++;
                        fill.style.width = (85 + Math.floor((ocrProgress / pagesToOCR.length) * 14)) + '%';
                        percentText.innerText = fill.style.width;

                        var pg = await pdfDoc.getPage(pageNum);
                        var viewport = pg.getViewport({ scale: 2.0 }); 
                        var cvs = document.createElement('canvas');
                        cvs.width = viewport.width;
                        cvs.height = viewport.height;
                        var cvsCtx = cvs.getContext('2d');
                        await pg.render({ canvasContext: cvsCtx, viewport: viewport }).promise;

                        var ret = await worker.recognize(cvs);
                        var ocrText = ret.data.text.replace(/\s+/g, '').toLowerCase();

                        if (!calc) {
                            var m = ocrText.match(/totalcalcium.*?([\d\.]+)/);
                            if (m) calc = parseFloat(m[1]);
                        }
                        
                        var cleanOcrText = ocrText.replace(/above\d+/g, '').replace(/\d+mmabove/g, '').replace(/lvot.*?distance.*?[\d\.]+/g, '');

                        if (!stjlHeight) {
                            var ml = cleanOcrText.match(/stjl.*?([\d\.]+)/);
                            if (ml && ml[1] && parseFloat(ml[1]) > 5) stjlHeight = parseFloat(ml[1]); 
                        }
                        
                        if (!stjrHeight) {
                            var mr = cleanOcrText.match(/stjr.*?([\d\.]+)/);
                            if (mr && mr[1] && parseFloat(mr[1]) > 5) stjrHeight = parseFloat(mr[1]); 
                        }
                        
                        if (!ascAortaHeight && (cleanOcrText.includes('ascending') || cleanOcrText.includes('aao'))) {
                            var m3 = cleanOcrText.match(/distance.*?([\d\.]+)/);
                            if (m3 && parseFloat(m3[1]) > 20) ascAortaHeight = parseFloat(m3[1]); 
                        }

                        if (calc && stjlHeight && stjrHeight && ascAortaHeight) break;
                    }
                    await worker.terminate();
                }

                if(!stjlHeight && stjFallback) stjlHeight = stjFallback;
                if(!stjrHeight && stjFallback) stjrHeight = stjFallback;

                fill.style.width = '100%'; percentText.innerText = '100%';
                statusText.innerText = "Data mapped successfully!";

                setTimeout(function() {
                    modal.style.display = 'none';

                    document.getElementById('in-name').value = patName || '';
                    document.getElementById('in-area').value = area || '';
                    document.getElementById('in-perim').value = perim || '';
                    document.getElementById('in-sov-diam').value = sovMean || '';
                    document.getElementById('in-stj-diam').value = stjDiam || '';
                    document.getElementById('in-rca').value = rca || '';
                    document.getElementById('in-lca').value = lca || '';
                    document.getElementById('in-asc-aorta').value = ascAorta || '';
                    document.getElementById('in-calc').value = calc || '';
                    document.getElementById('in-stjl-height').value = stjlHeight || '';
                    document.getElementById('in-stjr-height').value = stjrHeight || '';
                    document.getElementById('in-asc-height').value = ascAortaHeight || ''; 
                    
                    runSizingEngine();
                    event.target.value = ''; 

                    var warningNotes = "";
                    if(!calc || !stjlHeight || !ascAortaHeight) {
                        warningNotes = "Some pixel-embedded dimensions could not be resolved by OCR due to image noise. Please verify the 3mensio images and enter missing fields manually.";
                    }

                    showBrandedAlert(
                        "Parsing Complete", 
                        "3mensio report successfully parsed. Measurements have been mapped to the control panel.", 
                        warningNotes
                    );

                }, 400);

            }, 300);

        } catch (error) {
            modal.style.display = 'none';
            showBrandedAlert("System Error", "Failed to parse document: " + error.message, "Ensure you are uploading a valid 3mensio exported PDF. If the error persists, enter parameters manually.");
            event.target.value = '';
        }
    }

    function exportToPDF() {
        document.getElementById('action-buttons').style.display = 'none';
        var container = document.getElementById('report-container');
        container.classList.add('pdf-print-mode');
        var opt = { margin: [10, 36, 10, 36], filename: 'VenusVitae_Sizing_Report.pdf', image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true, windowWidth: 960, x: 0 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } };
        html2pdf().set(opt).from(container).save().then(function() {
            container.classList.remove('pdf-print-mode');
            document.getElementById('action-buttons').style.display = 'flex';
        });
    }

    var valveMath = {
        "AB20": { "8 mL": 260.16, "9 mL": 286.52, "10 mL": 307.91, "Nominal (11 mL)": 323.65, "11.5 mL": 333.29 },
        "AB23": { "13 mL": 330.06, "14 mL": 356.33, "15 mL": 380.13, "16 mL": 404.71, "Nominal (17 mL)": 419.10, "18 mL": 433.74 },
        "AB26": { "18 mL": 430.05, "19 mL": 456.17, "20 mL": 475.29, "21 mL": 490.87, "22 mL": 510.71, "Nominal (23 mL)": 526.85, "24 mL": 543.25, "25 mL": 551.55 },
        "AB29": { "25 mL": 543.25, "26 mL": 559.90, "27 mL": 585.35, "28 mL": 606.99, "29 mL": 620.16, "30 mL": 633.47, "31 mL": 642.42, "Nominal (32 mL)": 655.97, "33 mL": 669.66 }
    };

    var valveDiameters = {
        "AB20": { "8 mL": 18.2, "9 mL": 19.1, "10 mL": 19.8, "Nominal (11 mL)": 20.3, "11.5 mL": 20.6 },
        "AB23": { "13 mL": 20.5, "14 mL": 21.3, "15 mL": 22.0, "16 mL": 22.7, "Nominal (17 mL)": 23.1, "18 mL": 23.5 },
        "AB26": { "18 mL": 23.4, "19 mL": 24.1, "20 mL": 24.6, "21 mL": 25.0, "22 mL": 25.5, "Nominal (23 mL)": 25.9, "24 mL": 26.3, "25 mL": 26.5 },
        "AB29": { "25 mL": 26.3, "26 mL": 26.7, "27 mL": 27.3, "28 mL": 27.8, "29 mL": 28.1, "30 mL": 28.4, "31 mL": 28.6, "Nominal (32 mL)": 28.9, "33 mL": 29.2 }
    };

    var vitaeDimensions = {
        "AB20": { h0: 16.0, h1: 14.4, h2: 12.2, h3: 5.2 },
        "AB23": { h0: 18.1, h1: 16.6, h2: 14.0, h3: 6.2 },
        "AB26": { h0: 19.8, h1: 18.4, h2: 15.7, h3: 5.6 },
        "AB29": { h0: 22.0, h1: 20.7, h2: 17.8, h3: 6.8 }
    };

    var valveImagesModal = {
        "AB20": "https://raw.githubusercontent.com/fblucciano/imagens-venus/591ee121e1d7df96fe779e66cfbd03e88685f7ae/VITAE_20.jpg",
        "AB23": "https://raw.githubusercontent.com/fblucciano/imagens-venus/591ee121e1d7df96fe779e66cfbd03e88685f7ae/VITAE_23.jpg",
        "AB26": "https://raw.githubusercontent.com/fblucciano/imagens-venus/591ee121e1d7df96fe779e66cfbd03e88685f7ae/VITAE_26.jpg",
        "AB29": "https://raw.githubusercontent.com/fblucciano/imagens-venus/591ee121e1d7df96fe779e66cfbd03e88685f7ae/VITAE_29.jpg"
    };

    function openValveDetails(valveName) {
        document.getElementById('modalTitle').innerText = 'Venus Vitae (' + valveName + ')';
        document.getElementById('modalImg').src = valveImagesModal[valveName];
        document.getElementById('valveModal').style.display = 'flex';
    }

    function closeValveDetails(event) { if (event.target.id === 'valveModal') document.getElementById('valveModal').style.display = 'none'; }
    function closeModalDirect() { document.getElementById('valveModal').style.display = 'none'; }
    function openCreatorModal() { document.getElementById('creatorModal').style.display = 'flex'; }
    function closeCreatorModal(e) { if (e.target.id === 'creatorModal') document.getElementById('creatorModal').style.display = 'none'; }
    function closeCreatorModalDirect() { document.getElementById('creatorModal').style.display = 'none'; }

    var triggers = document.querySelectorAll('.trigger-calc');
    for(var i=0; i<triggers.length; i++) {
        triggers[i].addEventListener('input', runSizingEngine);
    }

    function runSizingEngine() {
        var area = parseFloat(document.getElementById('in-area').value);
        var perim = parseFloat(document.getElementById('in-perim').value);
        var pref = document.getElementById('in-pref').value;
        var volSelect = document.getElementById('in-vol');
        var calc = parseFloat(document.getElementById('in-calc').value);
        
        var refArea = (!isNaN(area) && area > 0) ? area : (Math.pow(perim, 2) / (4 * Math.PI));

        var activeValve = null;
        if (pref === 'Automatic') {
            if (refArea >= 260 && refArea <= 333.29) activeValve = 'AB20';
            else if (refArea > 333.29 && refArea <= 433.74) activeValve = 'AB23';
            else if (refArea > 433.74 && refArea <= 551.55) activeValve = 'AB26';
            else if (refArea > 551.55) activeValve = 'AB29'; 
        } else { activeValve = pref; }

        var vList = ['AB20', 'AB23', 'AB26', 'AB29'];
        for(var j=0; j<vList.length; j++) {
            var el = document.getElementById('card-' + vList[j]);
            if(el) el.classList.remove('active');
        }

        if (activeValve) {
            document.getElementById('card-' + activeValve).classList.add('active');
            var currentVol = volSelect.value;
            var options = Object.keys(valveMath[activeValve]);
            if (volSelect.dataset.valve !== activeValve) {
                volSelect.innerHTML = '';
                for(var k=0; k<options.length; k++) {
                    var optEl = document.createElement('option'); 
                    optEl.value = options[k]; 
                    optEl.innerText = options[k]; 
                    volSelect.appendChild(optEl);
                }
                volSelect.dataset.valve = activeValve;
                var defaultNominal = options[0];
                for(var k2=0; k2<options.length; k2++) {
                    if(options[k2].indexOf('Nominal') !== -1) { defaultNominal = options[k2]; break; }
                }
                var hasVol = false;
                for(var k3=0; k3<options.length; k3++) {
                    if(options[k3] === currentVol) { hasVol = true; break; }
                }
                volSelect.value = hasVol ? currentVol : defaultNominal;
            }
            var selectedVol = volSelect.value;
            document.getElementById('vitae-' + activeValve).innerText = valveMath[activeValve][selectedVol].toFixed(2);
        } else { 
            volSelect.innerHTML = '<option value="Nominal">Nominal</option>'; 
            volSelect.dataset.valve = ''; 
        }

        var lcaH = parseFloat(document.getElementById('in-lca').value);
        var rcaH = parseFloat(document.getElementById('in-rca').value);
        var stjDiam = parseFloat(document.getElementById('in-stj-diam').value);
        
        var stjlH = parseFloat(document.getElementById('in-stjl-height').value);
        var stjrH = parseFloat(document.getElementById('in-stjr-height').value);

        var resLca = document.getElementById('res-lca'), resRca = document.getElementById('res-rca'), resStjl = document.getElementById('res-stjl'), resStjr = document.getElementById('res-stjr'), resStjComp = document.getElementById('res-stj-comp'), resOversizeLbl = document.getElementById('res-oversize-label'), resOversizeVal = document.getElementById('res-oversize-val');

        if (!activeValve || isNaN(refArea) || refArea <= 0) {
            resLca.innerText = '--'; resRca.innerText = '--'; resStjl.innerText = '--'; resStjr.innerText = '--';
            resStjComp.innerText = '--';
            resOversizeLbl.innerText = 'OVERSIZING'; resOversizeVal.innerText = '--'; resOversizeVal.style.color = 'var(--text-grey)';
            
            storedValve = null; storedVolKey = null; storedData = null;
            updateHighlightUI();
        } else {
            var valveRiskHeightAboveAnnulus = vitaeDimensions[activeValve].h2 - vitaeDimensions[activeValve].h3;

            if (isNaN(lcaH)) resLca.innerText = '--';
            else {
                var gapLca = lcaH - valveRiskHeightAboveAnnulus;
                var colorLca = gapLca >= 0 ? '#2E7D32' : '#C62828';
                resLca.innerHTML = "<span style=\"color:" + colorLca + "; font-weight:bold; font-size:14px;\">" + (gapLca > 0 ? '+' : '') + gapLca.toFixed(1) + "mm</span>";
            }

            if (isNaN(rcaH)) resRca.innerText = '--';
            else {
                var gapRca = rcaH - valveRiskHeightAboveAnnulus;
                var colorRca = gapRca >= 0 ? '#2E7D32' : '#C62828';
                resRca.innerHTML = "<span style=\"color:" + colorRca + "; font-weight:bold; font-size:14px;\">" + (gapRca > 0 ? '+' : '') + gapRca.toFixed(1) + "mm</span>";
            }
            
            var valveFrameAboveAnnulus = vitaeDimensions[activeValve].h1 - vitaeDimensions[activeValve].h3;

            if(isNaN(stjlH)) resStjl.innerText = '--';
            else {
                var gapStjl = stjlH - valveFrameAboveAnnulus;
                var colorStjl = gapStjl >= 0 ? '#2E7D32' : '#C62828';
                resStjl.innerHTML = "<span style=\"color:" + colorStjl + "; font-weight:bold; font-size:14px;\">" + (gapStjl > 0 ? '+' : '') + gapStjl.toFixed(1) + "mm</span>";
            }

            if(isNaN(stjrH)) resStjr.innerText = '--';
            else {
                var gapStjr = stjrH - valveFrameAboveAnnulus;
                var colorStjr = gapStjr >= 0 ? '#2E7D32' : '#C62828';
                resStjr.innerHTML = "<span style=\"color:" + colorStjr + "; font-weight:bold; font-size:14px;\">" + (gapStjr > 0 ? '+' : '') + gapStjr.toFixed(1) + "mm</span>";
            }

            if (isNaN(stjDiam)) { resStjComp.innerText = '--'; } 
            else {
                var valveExpDiam = valveDiameters[activeValve][volSelect.value];
                var diff = stjDiam - valveExpDiam;
                var colorComp = diff >= 0 ? '#2E7D32' : '#C62828';
                resStjComp.innerHTML = "<span style=\"color:" + colorComp + "; font-size:16px; font-weight:bold;\">" + (diff > 0 ? '+' : '') + diff.toFixed(1) + "mm</span>";
            }

            var oversizePct = refArea > 0 ? ((valveMath[activeValve][volSelect.value] / refArea) - 1) * 100 : 0;
            resOversizeLbl.innerText = oversizePct >= 0 ? 'OVERSIZING' : 'UNDERSIZING';
            resOversizeVal.innerText = (oversizePct >= 0 ? '▲ ' : '▼ ') + Math.abs(oversizePct).toFixed(1) + '%';
            resOversizeVal.style.color = oversizePct >= 0 ? '#2E7D32' : '#C62828';

            storedValve = activeValve;
            storedVolKey = volSelect.value;
            storedData = {
                area: refArea,
                perim: parseFloat(document.getElementById('in-perim').value),
                sovD: parseFloat(document.getElementById('in-sov-diam').value),
                stjD: stjDiam,
                ascAorta: parseFloat(document.getElementById('in-asc-aorta').value),
                ascAortaH: parseFloat(document.getElementById('in-asc-height').value),
                stjlH: stjlH,
                stjrH: stjrH,
                lcaH: lcaH,
                rcaH: rcaH
            };

            updateHighlightUI();
        }

        var resCalc = document.getElementById('res-calc');
        if (isNaN(calc) || calc <= 0) { 
            resCalc.innerText = '--'; resCalc.style.color = 'var(--text-grey)'; 
        } else if (calc <= 400) { 
            resCalc.innerText = 'Mild'; resCalc.style.color = '#2E7D32'; 
        } else if (calc <= 600) { 
            resCalc.innerText = 'Moderate'; resCalc.style.color = '#E65100'; 
        } else { 
            resCalc.innerText = 'Severe'; resCalc.style.color = '#C62828'; 
        }
    }

    function drawStrokeText(ctx, text, x, y, color, strokeColor, lineWidth) {
        if(strokeColor === undefined) strokeColor = '#FFFFFF';
        if(lineWidth === undefined) lineWidth = 4;
        ctx.strokeStyle = strokeColor; ctx.lineWidth = lineWidth; ctx.lineJoin = 'round'; ctx.miterLimit = 2;
        ctx.strokeText(text, x, y); ctx.fillStyle = color; ctx.fillText(text, x, y);
    }

    function getClearanceText(anatDiam, valveDiam) {
        if (isNaN(anatDiam)) return '--';
        var diff = (anatDiam - valveDiam) / 2;
        var roundedDiff = Math.round(diff * 100) / 100;
        return roundedDiff >= 0 ? roundedDiff.toFixed(2) + "mm" : Math.abs(roundedDiff).toFixed(2) + "mm Tight";
    }

    function drawVitaeInteractiveRendering() {
        var canvas = document.getElementById('deploymentCanvas');
        var ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        textHitBoxes = []; 

        if (!storedValve || !storedData) {
            ctx.fillStyle = '#171434'; ctx.font = '16px "Space Mono", monospace'; ctx.textAlign = 'center';
            ctx.fillText("Enter parameters to generate interactive report.", canvas.width / 2, canvas.height / 2);
            return;
        }

        var valveName = storedValve;
        var volumeKey = storedVolKey;
        var data = storedData;

        var vDims = vitaeDimensions[valveName];
        
        var scale = 8.0; 
        
        var centerX = canvas.width / 2; 
        var baseY = 550; 

        var venusDeepBlue = '#171434'; 
        var venusTechGrey = '#DEDEDE'; 
        var venusYellow = '#FAA74A'; 
        
        var colorAnnulus = '#D32AA2'; 
        var colorSOV     = '#302B6A'; 
        var colorSTJ     = '#6448FC'; 
        var colorAsc     = '#105904'; 
        var colorRCA     = '#4A8507'; 
        var colorLCA     = '#D32AA2'; 
        
        var colorValveMesh = venusYellow; 
        var colorValveDiam = venusDeepBlue; 
        var colorValveHeight= '#F27C05'; 
        var colorValveSkirt = 'rgba(250, 167, 74, 0.4)';

        var currentDiamMm = valveDiameters[valveName][volumeKey];
        var textHorizRCA = getClearanceText(data.sovD, currentDiamMm);
        var textHorizLCA = getClearanceText(data.sovD, currentDiamMm);
        var textHorizSTJ = getClearanceText(data.stjD, currentDiamMm);

        var derivedAnnulusNum = data.perim ? (data.perim / Math.PI).toFixed(1) : (Math.sqrt(data.area / Math.PI) * 2).toFixed(1);
        var annulusDiamPx = derivedAnnulusNum * scale;
        var sovDiamPx = data.sovD ? (data.sovD * scale) : (32 * scale);
        var stjDiamPx = data.stjD ? (data.stjD * scale) : (28 * scale);
        var ascAortaPx = data.ascAorta ? (data.ascAorta * scale) : (30 * scale);
        
        var safeSovH = 18;
        if (!isNaN(data.stjlH) && !isNaN(data.stjrH)) { safeSovH = (data.stjlH + data.stjrH) / 2; } 
        else if (!isNaN(data.stjlH)) { safeSovH = data.stjlH; } 
        else if (!isNaN(data.stjrH)) { safeSovH = data.stjrH; }

        var sovHeightPx = safeSovH * scale;
        var stjY = baseY - sovHeightPx;
        
        var safeAscH = isNaN(data.ascAortaH) ? 40 : data.ascAortaH;
        var ascAortaHeightPx = safeAscH * scale;
        var ascAortaY = baseY - ascAortaHeightPx;

        var wallThickness = 6;
        var aortaColor = currentCanvasView === 'valve' ? '#F8F9FA' : venusTechGrey; 
        var aortaBorder = currentCanvasView === 'valve' ? venusTechGrey : '#575567'; 

        ctx.fillStyle = aortaColor; ctx.strokeStyle = aortaBorder; ctx.lineWidth = wallThickness; ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(centerX - annulusDiamPx/2 - 2, baseY + 70); ctx.lineTo(centerX - annulusDiamPx/2, baseY);
        ctx.bezierCurveTo(centerX - sovDiamPx/2 - 10, baseY - sovHeightPx * 0.15, centerX - sovDiamPx/2 - 10, baseY - sovHeightPx * 0.85, centerX - stjDiamPx/2, stjY);
        ctx.bezierCurveTo(centerX - ascAortaPx/2, stjY - 15, centerX - ascAortaPx/2, ascAortaY + 15, centerX - ascAortaPx/2, ascAortaY);
        ctx.bezierCurveTo(centerX - ascAortaPx/2, ascAortaY - 60, centerX + 20, ascAortaY - 120, centerX + 110, ascAortaY - 120);
        ctx.lineTo(centerX + 110, ascAortaY - 50);
        ctx.bezierCurveTo(centerX + 40, ascAortaY - 50, centerX + ascAortaPx/2, ascAortaY - 30, centerX + ascAortaPx/2, ascAortaY);
        ctx.bezierCurveTo(centerX + ascAortaPx/2, ascAortaY + 15, centerX + stjDiamPx/2, stjY - 15, centerX + stjDiamPx/2, stjY);
        ctx.bezierCurveTo(centerX + sovDiamPx/2 + 10, baseY - sovHeightPx * 0.85, centerX + sovDiamPx/2 + 10, baseY - sovHeightPx * 0.15, centerX + annulusDiamPx/2, baseY);
        ctx.lineTo(centerX + annulusDiamPx/2 + 2, baseY + 70);
        ctx.fill(); ctx.stroke();

        ctx.strokeStyle = aortaBorder; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(centerX - annulusDiamPx/2, baseY); ctx.quadraticCurveTo(centerX - 15, baseY - 20, centerX - 10, baseY - 50); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(centerX + annulusDiamPx/2, baseY); ctx.quadraticCurveTo(centerX + 15, baseY - 20, centerX + 10, baseY - 50); ctx.stroke();

        if (!isNaN(data.rcaH)) {
            var rcaY = baseY - (data.rcaH * scale); var rcaX = centerX - sovDiamPx/2 - 4;
            ctx.fillStyle = aortaColor; ctx.strokeStyle = aortaBorder; ctx.lineWidth = wallThickness;
            ctx.beginPath(); ctx.moveTo(rcaX, rcaY - 6); ctx.lineTo(rcaX - 25, rcaY - 12); ctx.lineTo(rcaX - 30, rcaY + 5); ctx.lineTo(rcaX, rcaY + 10); ctx.fill(); ctx.stroke();
            ctx.strokeStyle = aortaColor; ctx.lineWidth = wallThickness + 2; ctx.beginPath(); ctx.moveTo(rcaX + 3, rcaY - 5); ctx.lineTo(rcaX + 3, rcaY + 9); ctx.stroke();
        }
        if (!isNaN(data.lcaH)) {
            var lcaY = baseY - (data.lcaH * scale); var lcaX = centerX + sovDiamPx/2 + 4;
            ctx.fillStyle = aortaColor; ctx.strokeStyle = aortaBorder; ctx.lineWidth = wallThickness;
            ctx.beginPath(); ctx.moveTo(lcaX, lcaY - 6); ctx.lineTo(lcaX + 25, lcaY - 12); ctx.lineTo(lcaX + 30, lcaY + 5); ctx.lineTo(lcaX, lcaY + 10); ctx.fill(); ctx.stroke();
            ctx.strokeStyle = aortaColor; ctx.lineWidth = wallThickness + 2; ctx.beginPath(); ctx.moveTo(lcaX - 3, lcaY - 5); ctx.lineTo(lcaX - 3, lcaY + 9); ctx.stroke();
        }

        var valveRadiusPx = (currentDiamMm * scale) / 2;
        var skirtHeightPx = vDims.h3 * scale; 
        var frameHeightPx = vDims.h1 * scale; 
        var commissureHeightPx = vDims.h2 * scale; 
        var eyeletHeightPx = vDims.h0 * scale; 
        
        var inflowY = baseY + skirtHeightPx; 
        var skirtTopY = baseY; 
        var commissureY = inflowY - commissureHeightPx;
        var outflowY = inflowY - frameHeightPx; 
        var eyeletY = inflowY - eyeletHeightPx; 

        ctx.beginPath();
        ctx.moveTo(centerX - valveRadiusPx, inflowY); ctx.lineTo(centerX - valveRadiusPx, skirtTopY);
        ctx.lineTo(centerX + valveRadiusPx, skirtTopY); ctx.lineTo(centerX + valveRadiusPx, inflowY);
        ctx.closePath(); ctx.fillStyle = colorValveSkirt; ctx.fill();

        ctx.beginPath();
        ctx.moveTo(centerX - valveRadiusPx, skirtTopY); ctx.lineTo(centerX - valveRadiusPx, outflowY);
        ctx.lineTo(centerX + valveRadiusPx, outflowY); ctx.lineTo(centerX + valveRadiusPx, skirtTopY);
        ctx.closePath(); ctx.fillStyle = currentCanvasView === 'anatomy' ? 'rgba(250, 167, 74, 0.05)' : 'rgba(250, 167, 74, 0.15)'; ctx.fill();

        ctx.save();
        ctx.beginPath(); ctx.rect(centerX - valveRadiusPx, outflowY, valveRadiusPx*2, frameHeightPx); ctx.clip();
        ctx.strokeStyle = currentCanvasView === 'anatomy' ? 'rgba(55, 65, 81, 0.2)' : 'rgba(55, 65, 81, 0.6)';
        ctx.lineWidth = 1.2;
        for (var y = outflowY - 10; y < inflowY + 10; y += 18) {
            for (var x = centerX - valveRadiusPx - 10; x < centerX + valveRadiusPx + 10; x += 12) {
                ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 12, y + 18); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(x + 12, y); ctx.lineTo(x, y + 18); ctx.stroke();
            }
        }
        ctx.restore();

        ctx.strokeStyle = currentCanvasView === 'anatomy' ? 'rgba(250, 167, 74, 0.4)' : colorValveMesh; 
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(centerX - valveRadiusPx, inflowY); ctx.lineTo(centerX - valveRadiusPx, outflowY); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(centerX + valveRadiusPx, inflowY); ctx.lineTo(centerX + valveRadiusPx, outflowY); ctx.stroke();

        ctx.fillStyle = currentCanvasView === 'anatomy' ? 'rgba(250, 167, 74, 0.3)' : colorValveMesh;
        var pntX = [centerX - valveRadiusPx + 10, centerX, centerX + valveRadiusPx - 10];
        for(var i=0; i<pntX.length; i++) {
            var ex = pntX[i];
            ctx.beginPath(); ctx.moveTo(ex - 8, outflowY); ctx.lineTo(ex + 8, outflowY); ctx.lineTo(ex, eyeletY); ctx.closePath(); ctx.fill();
        }

        ctx.fillStyle = '#FBBF24'; ctx.strokeStyle = '#92400E'; ctx.lineWidth = 2;
        var markerSpread = valveRadiusPx * 0.65;
        var mxPnts = [centerX - markerSpread, centerX, centerX + markerSpread];
        for(var j=0; j<mxPnts.length; j++) {
            ctx.beginPath(); ctx.arc(mxPnts[j], baseY, 6, 0, 2*Math.PI); ctx.fill(); ctx.stroke();
        }

        var setAlpha = function(ids) {
            if (activeHighlight === null) {
                ctx.globalAlpha = 1.0;
                return;
            }
            if (Array.isArray(ids)) {
                ctx.globalAlpha = ids.includes(activeHighlight) ? 1.0 : 0.10;
            } else {
                ctx.globalAlpha = (activeHighlight === ids) ? 1.0 : 0.10;
            }
        };
        var resetAlpha = function() {
            ctx.globalAlpha = 1.0;
        };

        var registerHitBox = function(id, text, x, y, align, fontSize) {
            ctx.font = 'bold ' + fontSize + ' "Space Mono", monospace';
            var w = ctx.measureText(text).width;
            var h = parseInt(fontSize, 10) * 1.5;
            var bx = x;
            if(align === 'center') bx = x - w/2;
            else if(align === 'right') bx = x - w;
            
            textHitBoxes.push({ id: id, x: bx - 10, y: y - h/2 - 5, w: w + 20, h: h + 10 });
        };

        var registerVerticalHitBox = function(id, text, cx, cy, fontSize) {
            ctx.font = 'bold ' + fontSize + ' "Space Mono", monospace';
            var w = ctx.measureText(text).width;
            var h = parseInt(fontSize, 10) * 1.5;
            
            textHitBoxes.push({ id: id, x: cx - h/2 - 10, y: cy - w/2 - 10, w: h + 20, h: w + 20 });
        };

        var drawDimensionCallout = function(x1, y1, x2, y2, label, color, offsetY, fontSize) {
            if(offsetY === undefined) offsetY = -10;
            if(fontSize === undefined) fontSize = '18px';
            ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
            ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(x1, y1 - 5); ctx.lineTo(x1, y1 + 5); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(x2, y2 - 5); ctx.lineTo(x2, y2 + 5); ctx.stroke();
            ctx.font = "bold " + fontSize + " \"Space Mono\", monospace"; ctx.textAlign = 'center'; 
            drawStrokeText(ctx, label, (x1 + x2) / 2, y1 + offsetY, color, '#FFFFFF', 6);
        };

        var drawVerticalBracket = function(xPos, yTop, yBot, label, color, align, fontSize) {
            if(fontSize === undefined) fontSize = '18px';
            ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.setLineDash([4, 4]);
            ctx.beginPath(); ctx.moveTo(xPos, yTop); ctx.lineTo(xPos, yBot); ctx.stroke(); ctx.setLineDash([]);
            ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(xPos - 5, yTop); ctx.lineTo(xPos + 5, yTop); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(xPos - 5, yBot); ctx.lineTo(xPos + 5, yBot); ctx.stroke();
            
            if (currentCanvasView !== 'clinical') {
                ctx.save(); ctx.translate(align === 'left' ? xPos - 22 : xPos + 28, (yTop + yBot)/2); ctx.rotate(-Math.PI/2);
                ctx.font = "bold " + fontSize + " \"Space Mono\", monospace"; ctx.textAlign = 'center'; 
                drawStrokeText(ctx, label, 0, 0, color, '#FFFFFF', 6);
                ctx.restore();
            }
        };


        if (currentCanvasView === 'anatomy') {
            document.getElementById('preview-caption').innerHTML = "<b>Anatomy Mode:</b> Explicit patient dimensions mapped to the Annulus plane.<br> <span style='color:var(--venus-yellow)'>* Click/Hover on any input to isolate measures.</span>";
            
            setAlpha('annulus');
            drawDimensionCallout(centerX - annulusDiamPx/2, baseY, centerX + annulusDiamPx/2, baseY, "Annulus Ø: " + derivedAnnulusNum + "mm", colorAnnulus, -10, '18px');
            registerHitBox('annulus', "Annulus Ø: " + derivedAnnulusNum + "mm", centerX, baseY - 10, 'center', '18px');
            resetAlpha();

            setAlpha('sov');
            drawDimensionCallout(centerX - sovDiamPx/2 - 4, baseY - sovHeightPx/2, centerX + sovDiamPx/2 + 4, baseY - sovHeightPx/2, "SOV Ø: " + data.sovD + "mm", colorSOV, -10, '18px');
            registerHitBox('sov', "SOV Ø: " + data.sovD + "mm", centerX, baseY - sovHeightPx/2 - 10, 'center', '18px');
            resetAlpha();

            if(!isNaN(data.stjD)) {
                setAlpha('stj');
                drawDimensionCallout(centerX - stjDiamPx/2, stjY, centerX + stjDiamPx/2, stjY, "STJ Ø: " + data.stjD + "mm", colorSTJ, -10, '18px');
                registerHitBox('stj', "STJ Ø: " + data.stjD + "mm", centerX, stjY - 10, 'center', '18px');
                resetAlpha();
            }

            if(!isNaN(data.ascAorta)) {
                setAlpha('asc');
                drawDimensionCallout(centerX - ascAortaPx/2, ascAortaY, centerX + ascAortaPx/2, ascAortaY, "Asc. Aorta Ø: " + data.ascAorta + "mm", colorAsc, -10, '18px');
                registerHitBox('asc', "Asc. Aorta Ø: " + data.ascAorta + "mm", centerX, ascAortaY - 10, 'center', '18px');
                resetAlpha();
            }

            if(!isNaN(data.ascAortaH)) {
                setAlpha('asc');
                drawVerticalBracket(centerX - 350, ascAortaY, baseY, "Asc. Aorta H: " + data.ascAortaH + "mm", colorAsc, 'left');
                registerVerticalHitBox('asc', "Asc. Aorta H: " + data.ascAortaH + "mm", centerX - 350 - 22, (ascAortaY + baseY)/2, '18px');
                resetAlpha();
            }
            
            if (!isNaN(data.rcaH)) {
                setAlpha('rca');
                var rcaY = baseY - (data.rcaH * scale); var rLineX = centerX - 180;
                drawVerticalBracket(rLineX, rcaY, baseY, "RCA H: " + data.rcaH + "mm", colorRCA, 'left');
                registerVerticalHitBox('rca', "RCA H: " + data.rcaH + "mm", rLineX - 22, (rcaY + baseY)/2, '18px');
                resetAlpha();
            }

            if (!isNaN(data.stjrH)) {
                setAlpha('stjr');
                drawVerticalBracket(centerX - 260, baseY - (data.stjrH * scale), baseY, "STJ Right H: " + data.stjrH + "mm", colorSTJ, 'left');
                registerVerticalHitBox('stjr', "STJ Right H: " + data.stjrH + "mm", centerX - 260 - 22, (baseY - (data.stjrH * scale) + baseY)/2, '18px');
                resetAlpha();
            }
            if (!isNaN(data.stjlH)) {
                setAlpha('stjl');
                drawVerticalBracket(centerX + 260, baseY - (data.stjlH * scale), baseY, "STJ Left H: " + data.stjlH + "mm", colorSTJ, 'right');
                registerVerticalHitBox('stjl', "STJ Left H: " + data.stjlH + "mm", centerX + 260 + 28, (baseY - (data.stjlH * scale) + baseY)/2, '18px');
                resetAlpha();
            }
            
            if (!isNaN(data.lcaH)) {
                setAlpha('lca');
                var lcaY2 = baseY - (data.lcaH * scale); var lLineX2 = centerX + 180;
                drawVerticalBracket(lLineX2, lcaY2, baseY, "LCA H: " + data.lcaH + "mm", colorLCA, 'right');
                registerVerticalHitBox('lca', "LCA H: " + data.lcaH + "mm", lLineX2 + 28, (lcaY2 + baseY)/2, '18px');
                resetAlpha();
            }
        }
        else if (currentCanvasView === 'valve') {
            document.getElementById('preview-caption').innerHTML = "<b>Valve Specs Mode:</b> Viewing " + valveName + " dynamic volume expansion (" + volumeKey + ") and technical heights.";
            
            drawDimensionCallout(centerX - valveRadiusPx, inflowY + 22, centerX + valveRadiusPx, inflowY + 22, "D1 Inflow: " + currentDiamMm + "mm", colorValveDiam, -10, '20px');
            drawDimensionCallout(centerX - valveRadiusPx, outflowY - 15, centerX + valveRadiusPx, outflowY - 15, "Diameter: " + currentDiamMm + "mm", colorValveDiam, -10, '20px');

            var drawValveHeightBracket = function(xPos2, yTop2, yBot2, label2, side, textXOffset) {
                ctx.strokeStyle = colorValveHeight; ctx.lineWidth = 2.5; ctx.setLineDash([4, 4]); ctx.beginPath();
                if (side === 'left') {
                    ctx.moveTo(xPos2 + 15, yTop2); ctx.lineTo(xPos2, yTop2); ctx.lineTo(xPos2, yBot2); ctx.lineTo(xPos2 + 15, yBot2); ctx.stroke(); ctx.setLineDash([]);
                    ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(xPos2 + 15, yTop2 - 5); ctx.lineTo(xPos2 + 15, yTop2 + 5); ctx.stroke(); ctx.beginPath(); ctx.moveTo(xPos2 + 15, yBot2 - 5); ctx.lineTo(xPos2 + 15, yBot2 + 5); ctx.stroke();
                    
                    var tX = textXOffset ? textXOffset : xPos2 - 10;
                    ctx.font = 'bold 20px "Space Mono", monospace'; ctx.textAlign = 'right';
                    drawStrokeText(ctx, label2, tX, (yTop2 + yBot2)/2 + 6, colorValveHeight, '#FFFFFF', 7);
                } else {
                    ctx.moveTo(xPos2 - 15, yTop2); ctx.lineTo(xPos2, yTop2); ctx.lineTo(xPos2, yBot2); ctx.lineTo(xPos2 - 15, yBot2); ctx.stroke(); ctx.setLineDash([]);
                    ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(xPos2 - 15, yTop2 - 5); ctx.lineTo(xPos2 - 15, yTop2 + 5); ctx.stroke(); ctx.beginPath(); ctx.moveTo(xPos2 - 15, yBot2 - 5); ctx.lineTo(xPos2 - 15, yBot2 + 5); ctx.stroke();
                    
                    ctx.font = 'bold 20px "Space Mono", monospace'; ctx.textAlign = 'left';
                    drawStrokeText(ctx, label2, xPos2 + 15, (yTop2 + yBot2)/2 + 6, colorValveHeight, '#FFFFFF', 7);
                }
            };

            var leftH3X = centerX - valveRadiusPx - 60; 
            var leftH1X = leftH3X; 
            var textAlignLeft = leftH1X - 15; 
            
            drawValveHeightBracket(leftH1X, baseY, inflowY, "H3 Skirt: " + vDims.h3 + "mm", 'left', textAlignLeft); 
            drawValveHeightBracket(leftH3X, outflowY, inflowY, "H1 Frame: " + vDims.h1 + "mm", 'left', textAlignLeft);
            
            var rightH2X = centerX + valveRadiusPx + 60;
            drawValveHeightBracket(rightH2X, commissureY, inflowY, "H2 Commissure: " + vDims.h2 + "mm", 'right');
        }
        else if (currentCanvasView === 'clinical') {
            document.getElementById('preview-caption').innerHTML = "<b>Clearance Match Mode:</b> Dynamic STJ & Coronary clearance evaluating Balloon Volume expansion.<br> <span style='color:var(--venus-yellow)'>* Click/Hover on any input or card to isolate measures.</span>";

            var oversize = (((valveMath[valveName][volumeKey] / data.area) - 1) * 100).toFixed(1);
            var overBoxY = baseY + 110; 
            
            setAlpha('annulus');
            ctx.strokeStyle = colorAnnulus; ctx.lineWidth = 2.5; ctx.setLineDash([4,4]);
            ctx.beginPath(); ctx.moveTo(centerX, baseY); ctx.lineTo(centerX, overBoxY - 15); ctx.stroke(); ctx.setLineDash([]);
            ctx.font = 'bold 22px "Space Mono", monospace'; ctx.textAlign = 'center';
            var oversizeText = "Annulus Oversize: " + (oversize >= 0 ? '+' : '') + oversize + "%";
            drawStrokeText(ctx, oversizeText, centerX, overBoxY + 5, colorAnnulus, '#FFFFFF', 7);
            registerHitBox('annulus', oversizeText, centerX, overBoxY + 5, 'center', '22px');
            resetAlpha();

            var valveWallX_Right = centerX + valveRadiusPx;
            var valveWallX_Left = centerX - valveRadiusPx;
            var colorSOVC = '#575567';

            if (!isNaN(data.stjD)) {
                setAlpha('stj');
                var stjWallX_Right = centerX + stjDiamPx/2;
                var stjWallX_Left = centerX - stjDiamPx/2;

                ctx.strokeStyle = 'rgba(100, 72, 252, 0.4)'; ctx.lineWidth = 2.5; ctx.setLineDash([8,4]);
                ctx.beginPath(); ctx.moveTo(centerX - 120, stjY); ctx.lineTo(centerX + 120, stjY); ctx.stroke(); ctx.setLineDash([]);
                ctx.font = 'bold 18px "Space Mono", monospace'; ctx.textAlign = 'center';
                drawStrokeText(ctx, "STJ Plane", centerX, stjY - 6, colorSTJ, '#FFFFFF', 6);

                ctx.strokeStyle = colorSTJ; ctx.lineWidth = 2.5;
                ctx.beginPath(); ctx.moveTo(valveWallX_Right, stjY); ctx.lineTo(stjWallX_Right, stjY); ctx.stroke();
                ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(valveWallX_Right, stjY - 5); ctx.lineTo(valveWallX_Right, stjY + 5); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(stjWallX_Right, stjY - 5); ctx.lineTo(stjWallX_Right, stjY + 5); ctx.stroke();
                
                var stjTextR = "STJ Radial: " + textHorizSTJ;
                ctx.font = 'bold 18px "Space Mono", monospace'; ctx.textAlign = 'left';
                drawStrokeText(ctx, stjTextR, stjWallX_Right + 12, stjY + 6, colorSTJ, '#FFFFFF', 6);
                registerHitBox('stj', stjTextR, stjWallX_Right + 12, stjY + 6, 'left', '18px');

                ctx.strokeStyle = colorSTJ; ctx.lineWidth = 2.5;
                ctx.beginPath(); ctx.moveTo(valveWallX_Left, stjY); ctx.lineTo(stjWallX_Left, stjY); ctx.stroke();
                ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(valveWallX_Left, stjY - 5); ctx.lineTo(valveWallX_Left, stjY + 5); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(stjWallX_Left, stjY - 5); ctx.lineTo(stjWallX_Left, stjY + 5); ctx.stroke();
                
                var stjTextL = "STJ Radial: " + textHorizSTJ;
                ctx.textAlign = 'right';
                drawStrokeText(ctx, stjTextL, stjWallX_Left - 12, stjY + 6, colorSTJ, '#FFFFFF', 6);
                registerHitBox('stj', stjTextL, stjWallX_Left - 12, stjY + 6, 'right', '18px');
                resetAlpha();
            }

            setAlpha('sov');
            var sovMidY = baseY - (sovHeightPx / 2);
            var sovWallX_Right = centerX + sovDiamPx/2;
            var sovWallX_Left = centerX - sovDiamPx/2;
            
            ctx.strokeStyle = colorSOVC; ctx.lineWidth = 2.0; ctx.setLineDash([2,2]);
            ctx.beginPath(); ctx.moveTo(valveWallX_Right, sovMidY); ctx.lineTo(sovWallX_Right, sovMidY); ctx.stroke(); ctx.setLineDash([]);
            ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(valveWallX_Right, sovMidY - 4); ctx.lineTo(valveWallX_Right, sovMidY + 4); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(sovWallX_Right, sovMidY - 4); ctx.lineTo(sovWallX_Right, sovMidY + 4); ctx.stroke();
            
            var sovTextR = "SOV Radial: " + textHorizRCA;
            ctx.font = 'bold 16px "Space Mono", monospace'; ctx.textAlign = 'left';
            drawStrokeText(ctx, sovTextR, sovWallX_Right + 12, sovMidY + 5, colorSOVC, '#FFFFFF', 5);
            registerHitBox('sov', sovTextR, sovWallX_Right + 12, sovMidY + 5, 'left', '16px');

            ctx.strokeStyle = colorSOVC; ctx.lineWidth = 2.0; ctx.setLineDash([2,2]);
            ctx.beginPath(); ctx.moveTo(valveWallX_Left, sovMidY); ctx.lineTo(sovWallX_Left, sovMidY); ctx.stroke(); ctx.setLineDash([]);
            ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(valveWallX_Left, sovMidY - 4); ctx.lineTo(valveWallX_Left, sovMidY + 4); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(sovWallX_Left, sovMidY - 4); ctx.lineTo(sovWallX_Left, sovMidY + 4); ctx.stroke();
            
            var sovTextL = "SOV Radial: " + textHorizLCA;
            ctx.textAlign = 'right';
            drawStrokeText(ctx, sovTextL, sovWallX_Left - 12, sovMidY + 5, colorSOVC, '#FFFFFF', 5);
            registerHitBox('sov', sovTextL, sovWallX_Left - 12, sovMidY + 5, 'right', '16px');
            resetAlpha();

            setAlpha(['lca', 'rca']);
            ctx.strokeStyle = 'rgba(217, 119, 6, 0.5)'; ctx.lineWidth = 2; ctx.setLineDash([4,4]);
            ctx.beginPath(); ctx.moveTo(centerX - 240, commissureY); ctx.lineTo(centerX + 240, commissureY); ctx.stroke(); ctx.setLineDash([]);
            resetAlpha();

            if (!isNaN(data.rcaH)) {
                setAlpha('rca');
                var rcaY3 = baseY - (data.rcaH * scale); var rLineX = centerX - 220;
                ctx.strokeStyle = colorRCA; ctx.lineWidth = 2; ctx.setLineDash([2,2]);
                ctx.beginPath(); ctx.moveTo(centerX - sovDiamPx/2, rcaY3); ctx.lineTo(rLineX, rcaY3); ctx.stroke(); ctx.setLineDash([]);
                ctx.strokeStyle = colorRCA; ctx.lineWidth = 3.5;
                ctx.beginPath(); ctx.moveTo(rLineX, rcaY3); ctx.lineTo(rLineX, commissureY); ctx.stroke();
                ctx.lineWidth = 7;
                ctx.beginPath(); ctx.moveTo(rLineX - 5, rcaY3); ctx.lineTo(rLineX + 5, rcaY3); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(rLineX - 5, commissureY); ctx.lineTo(rLineX + 5, commissureY); ctx.stroke();
                
                var rcaGapMm = (data.rcaH - (vDims.h2 - vDims.h3)).toFixed(1);
                var gapLabelRCA = "RCA Gap: " + (rcaGapMm > 0 ? '+' : '') + rcaGapMm + "mm";
                
                ctx.save(); ctx.translate(rLineX - 18, (rcaY3 + commissureY)/2); ctx.rotate(-Math.PI/2);
                ctx.font = 'bold 18px "Space Mono", monospace'; ctx.textAlign = 'center';
                drawStrokeText(ctx, gapLabelRCA, 0, 0, colorRCA, '#FFFFFF', 6);
                ctx.restore();
                
                registerVerticalHitBox('rca', gapLabelRCA, rLineX - 18, (rcaY3 + commissureY)/2, '18px');
                resetAlpha();
            }

            if (!isNaN(data.lcaH)) {
                setAlpha('lca');
                var lcaY3 = baseY - (data.lcaH * scale); var lLineX = centerX + 220;
                ctx.strokeStyle = colorLCA; ctx.lineWidth = 2; ctx.setLineDash([2,2]);
                ctx.beginPath(); ctx.moveTo(centerX + sovDiamPx/2, lcaY3); ctx.lineTo(lLineX, lcaY3); ctx.stroke(); ctx.setLineDash([]);
                ctx.strokeStyle = colorLCA; ctx.lineWidth = 3.5;
                ctx.beginPath(); ctx.moveTo(lLineX, lcaY3); ctx.lineTo(lLineX, commissureY); ctx.stroke();
                ctx.lineWidth = 7;
                ctx.beginPath(); ctx.moveTo(lLineX - 5, lcaY3); ctx.lineTo(lLineX + 5, lcaY3); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(lLineX - 5, commissureY); ctx.lineTo(lLineX + 5, commissureY); ctx.stroke();
                
                var lcaGapMm = (data.lcaH - (vDims.h2 - vDims.h3)).toFixed(1);
                var gapLabelLCA = "LCA Gap: " + (lcaGapMm > 0 ? '+' : '') + lcaGapMm + "mm";
                
                ctx.save(); ctx.translate(lLineX + 22, (lcaY3 + commissureY)/2); ctx.rotate(-Math.PI/2);
                ctx.font = 'bold 18px "Space Mono", monospace'; ctx.textAlign = 'center';
                drawStrokeText(ctx, gapLabelLCA, 0, 0, colorLCA, '#FFFFFF', 6);
                ctx.restore();

                registerVerticalHitBox('lca', gapLabelLCA, lLineX + 22, (lcaY3 + commissureY)/2, '18px');
                resetAlpha();
            }

            if (!isNaN(data.stjrH)) {
                setAlpha('stjr');
                var stjrY = baseY - (data.stjrH * scale); var stjRightLineX = centerX - 310;
                ctx.strokeStyle = colorSTJ; ctx.lineWidth = 2; ctx.setLineDash([2,2]);
                ctx.beginPath(); ctx.moveTo(centerX - stjDiamPx/2, stjrY); ctx.lineTo(stjRightLineX, stjrY); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(centerX - valveRadiusPx, outflowY); ctx.lineTo(stjRightLineX, outflowY); ctx.stroke(); ctx.setLineDash([]);
                ctx.strokeStyle = colorSTJ; ctx.lineWidth = 3.5;
                ctx.beginPath(); ctx.moveTo(stjRightLineX, stjrY); ctx.lineTo(stjRightLineX, outflowY); ctx.stroke();
                ctx.lineWidth = 7;
                ctx.beginPath(); ctx.moveTo(stjRightLineX - 5, stjrY); ctx.lineTo(stjRightLineX + 5, stjrY); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(stjRightLineX - 5, outflowY); ctx.lineTo(stjRightLineX + 5, outflowY); ctx.stroke();

                var vGapMmR = (data.stjrH - (vDims.h1 - vDims.h3)).toFixed(1); 
                var gapLabelR = "STJ R Gap: " + (vGapMmR >= 0 ? "+" + vGapMmR : vGapMmR) + "mm";

                ctx.save(); ctx.translate(stjRightLineX - 18, (stjrY + outflowY)/2); ctx.rotate(-Math.PI/2);
                ctx.font = 'bold 18px "Space Mono", monospace'; ctx.textAlign = 'center';
                drawStrokeText(ctx, gapLabelR, 0, 0, colorSTJ, '#FFFFFF', 6);
                ctx.restore();

                registerVerticalHitBox('stjr', gapLabelR, stjRightLineX - 18, (stjrY + outflowY)/2, '18px');
                resetAlpha();
            }

            if (!isNaN(data.stjlH)) {
                setAlpha('stjl');
                var stjlY = baseY - (data.stjlH * scale); var stjLeftLineX = centerX + 310; 
                ctx.strokeStyle = colorSTJ; ctx.lineWidth = 2; ctx.setLineDash([2,2]);
                ctx.beginPath(); ctx.moveTo(centerX + stjDiamPx/2, stjlY); ctx.lineTo(stjLeftLineX, stjlY); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(centerX + valveRadiusPx, outflowY); ctx.lineTo(stjLeftLineX, outflowY); ctx.stroke(); ctx.setLineDash([]);
                ctx.strokeStyle = colorSTJ; ctx.lineWidth = 3.5;
                ctx.beginPath(); ctx.moveTo(stjLeftLineX, stjlY); ctx.lineTo(stjLeftLineX, outflowY); ctx.stroke();
                ctx.lineWidth = 7;
                ctx.beginPath(); ctx.moveTo(stjLeftLineX - 5, stjlY); ctx.lineTo(stjLeftLineX + 5, stjlY); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(stjLeftLineX - 5, outflowY); ctx.lineTo(stjLeftLineX + 5, outflowY); ctx.stroke();

                var vGapMmL = (data.stjlH - (vDims.h1 - vDims.h3)).toFixed(1); 
                var gapLabelL = "STJ L Gap: " + (vGapMmL >= 0 ? "+" + vGapMmL : vGapMmL) + "mm";

                ctx.save(); ctx.translate(stjLeftLineX + 22, (stjlY + outflowY)/2); ctx.rotate(-Math.PI/2);
                ctx.font = 'bold 18px "Space Mono", monospace'; ctx.textAlign = 'center';
                drawStrokeText(ctx, gapLabelL, 0, 0, colorSTJ, '#FFFFFF', 6);
                ctx.restore();

                registerVerticalHitBox('stjl', gapLabelL, stjLeftLineX + 22, (stjlY + outflowY)/2, '18px');
                resetAlpha();
            }

            setAlpha('annulus');
            var implantDepthX2 = centerX - 140; 
            ctx.strokeStyle = venusDeepBlue; ctx.setLineDash([4, 4]); ctx.lineWidth = 2.5;
            ctx.beginPath(); 
            ctx.moveTo(centerX - valveRadiusPx - 5, baseY); ctx.lineTo(implantDepthX2, baseY);
            ctx.moveTo(centerX - valveRadiusPx - 5, inflowY); ctx.lineTo(implantDepthX2, inflowY);
            ctx.moveTo(implantDepthX2 + 10, baseY); ctx.lineTo(implantDepthX2 + 10, inflowY); 
            ctx.stroke(); ctx.setLineDash([]);
            ctx.font = 'bold 18px "Space Mono", monospace'; ctx.textAlign = 'right';
            drawStrokeText(ctx, "-" + vDims.h3 + "mm", implantDepthX2 - 5, baseY + (skirtHeightPx/2) + 6, venusDeepBlue, '#FFFFFF', 6);
            resetAlpha();
        }
    }

    try {
        if (sessionStorage.getItem('venus_vitae_sizing_ok') === '1') {
            unlockApp();
        }
    } catch (err) {}

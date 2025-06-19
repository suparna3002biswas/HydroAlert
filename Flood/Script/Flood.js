function detectFlood() {
    const mediaType = document.getElementById("mediaType").value;
    const fileInput = document.getElementById("uploadFile");
    const output = document.getElementById("output");
    const loading = document.getElementById("loading");
    const resultContainer = document.getElementById("resultContainer");
    
    if (!fileInput.files.length) {
        alert("Please upload a " + mediaType + " file.");
        return;
    }
    
    const file = fileInput.files[0];
    const fileUrl = URL.createObjectURL(file);
    
    // Show loading indicator
    output.style.display = "block";
    loading.style.display = "block";
    resultContainer.style.display = "none";
    
    // Clear previous results
    resultContainer.innerHTML = "";
    
    // Update loading message based on media type
    const loadingText = loading.querySelector("p");
    loadingText.textContent = mediaType === "image" ? 
        "Analyzing image for flood conditions..." : 
        "Processing video frames... This may take a moment...";
    
    // Add progress bar for videos
    if (mediaType === "video") {
        if (!loading.querySelector(".progress-bar")) {
            const progressBar = document.createElement("div");
            progressBar.className = "progress-bar";
            progressBar.innerHTML = `
                <div class="progress-container">
                    <div class="progress-fill"></div>
                </div>
                <div class="progress-text">0%</div>
            `;
            loading.appendChild(progressBar);
        }
    } else {
        // Remove progress bar if exists
        const progressBar = loading.querySelector(".progress-bar");
        if (progressBar) progressBar.remove();
    }
    
    // Start progress simulation for videos
    let progressInterval;
    if (mediaType === "video") {
        let progress = 0;
        const progressFill = document.querySelector(".progress-fill");
        const progressText = document.querySelector(".progress-text");
        
        progressInterval = setInterval(() => {
            progress = Math.min(progress + 2, 90); // Stop at 90% until done
            progressFill.style.width = progress + "%";
            progressText.textContent = progress + "%";
        }, 500);
    }
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('mediaType', mediaType);
    
    fetch('/detect', {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        // Clear progress interval
        if (progressInterval) clearInterval(progressInterval);
        
        // Complete progress bar
        if (mediaType === "video") {
            const progressFill = document.querySelector(".progress-fill");
            const progressText = document.querySelector(".progress-text");
            progressFill.style.width = "100%";
            progressText.textContent = "100%";
            
            // Add small delay so user sees 100%
            setTimeout(() => {
                processResults(data, mediaType, file, fileUrl);
            }, 500);
        } else {
            processResults(data, mediaType, file, fileUrl);
        }
    })
    .catch(err => {
        // Clear progress interval
        if (progressInterval) clearInterval(progressInterval);
        
        loading.style.display = "none";
        output.style.display = "block";
        output.innerHTML = `
            <div class="error">
                <h3>Error Processing Request</h3>
                <p>${err.message || "Unknown error occurred"}</p>
                <p>Please try again with a different file.</p>
            </div>
        `;
        console.error("Detection error:", err);
    });
    
    function processResults(data, mediaType, file, fileUrl) {
        loading.style.display = "none";
        resultContainer.style.display = "block";
        resultContainer.innerHTML = "";
        
        if (data.error) {
            resultContainer.innerHTML = `
                <div class="error">
                    <h3>Processing Error</h3>
                    <p>${data.error}</p>
                </div>
            `;
            return;
        }
        
        if (mediaType === 'image') {
            resultContainer.innerHTML = `

                <div class="media-container">
                    <img src="${fileUrl}" alt="Uploaded image">
                    <div class="prediction-overlay ${data.is_flood ? 'flood' : 'non-flood'}">
                        ${data.is_flood ? '🌊 FLOOD' : '✅ NON-FLOOD'} (${data.confidence.toFixed(1)}%)
                    </div>
                </div>
                
                <div class="result-card">
                    <h3 class="${data.is_flood ? 'result-flood' : 'result-non-flood'}">
                        ${data.result}
                    </h3>
                    <p class="confidence">Confidence: ${data.confidence.toFixed(1)}%</p>
                    <div class="advice">
                        <p>${data.is_flood ? 
                            '⚠️ Flood conditions detected. Take necessary precautions!' : 
                            '✅ No flood conditions detected. Situation appears normal.'}
                        </p>
                        ${data.is_flood ? `
                        <h4>Recommended Actions:</h4>
                        <ul>
                            <li>Move to higher ground immediately</li>
                            <li>Avoid walking or driving through flood waters</li>
                            <li>Follow local emergency instructions</li>
                            <li>Prepare emergency supplies</li>
                        </ul>
                        ` : ''}
                    </div>
                </div>
            `;
        } else {
            resultContainer.innerHTML = `

                <div class="media-container">
                    <video controls>
                        <source src="${fileUrl}" type="${file.type}">
                        Your browser does not support the video tag.
                    </video>
                    <div class="prediction-overlay ${data.is_flood ? 'flood' : 'non-flood'}">
                        ${data.is_flood ? '🌊 FLOOD DETECTED' : '✅ NON-FLOOD'}
                    </div>
                </div>

                <div class="result-card">
                    <h3 class="${data.is_flood ? 'result-flood' : 'result-non-flood'}">
                        ${data.result}
                    </h3>
                    <div class="stats">
                        <div class="stat-item">
                            <div class="stat-value">${data.flood_percentage.toFixed(1)}%</div>
                            <div class="stat-label">Flood Frames</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">${data.flood_frames}/${data.total_frames}</div>
                            <div class="stat-label">Frames Analyzed</div>
                        </div>
                    </div>
                    <div class="advice">
                        <p>${data.is_flood ? 
                            '⚠️ Significant flood conditions detected in the video. Immediate action recommended!' : 
                            '✅ Minimal flood indicators detected. Situation appears under control.'}
                        </p>
                        ${data.is_flood ? `
                        <h4>Emergency Protocol:</h4>
                        <ul>
                            <li>Evacuate to designated safe zones</li>
                            <li>Monitor local weather alerts</li>
                            <li>Prepare emergency evacuation kit</li>
                            <li>Contact emergency services if trapped</li>
                        </ul>
                        ` : ''}
                    </div>
                </div>
            `;
        }
        
        // Add a button to analyze another file
        const newAnalysisBtn = document.createElement("button");
        newAnalysisBtn.textContent = "Analyze Another File";
        newAnalysisBtn.className = "new-analysis-btn";
        newAnalysisBtn.onclick = () => {
            document.getElementById("uploadFile").value = "";
            output.style.display = "none";
            resultContainer.style.display = "none";
        };
        resultContainer.appendChild(newAnalysisBtn);
    }
}
let chartIndex = 0;
let currentChart = null;
const chartFunctions = [];

// Register plugin globally (ensure Chart.js is loaded before this line)
Chart.register(ChartDataLabels);

fetch('water_pollution_disease.csv')
  .then(res => res.text())
  .then(data => {
    const rows = data.trim().split('\n');
    const headers = rows[0].split(',');

    const parsed = rows.slice(1).map(row => row.split(','));

    const countryCounts = {};
    const regionCounts = {};
    const waterSourceCounts = {};
    const treatmentCounts = {};
    const temperature = [];
    const pH = [];
    const dissolvedO2 = [];
    const labels = [];

    parsed.forEach((cols, i) => {
      const country = cols[0];
      const region = cols[1];
      const waterSource = cols[3];
      const treatment = cols[11];
      const temp = parseFloat(cols[22]);
      const doLevel = parseFloat(cols[7]);
      const pHLevel = parseFloat(cols[5]);

      countryCounts[country] = (countryCounts[country] || 0) + 1;
      regionCounts[region] = (regionCounts[region] || 0) + 1;
      waterSourceCounts[waterSource] = (waterSourceCounts[waterSource] || 0) + 1;
      if (treatment) {
        treatmentCounts[treatment] = (treatmentCounts[treatment] || 0) + 1;
      }

      labels.push(`Sample ${i + 1}`);
      temperature.push(temp);
      dissolvedO2.push(doLevel);
      pH.push(pHLevel);
    });

    const ctx = document.getElementById('qualityChart').getContext('2d');

    function renderCombinedChart() {
      return new Chart(ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'Temperature (°C)',
              data: temperature,
              borderColor: 'red',
              fill: false
            },
            {
              label: 'Dissolved Oxygen (mg/L)',
              data: dissolvedO2,
              borderColor: 'blue',
              fill: false
            },
            {
              label: 'pH Level',
              data: pH,
              borderColor: 'green',
              fill: false
            }
          ]
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: 'top'
            },
            title: {
              display: true,
              text: 'Water Quality Metrics'
            }
          }
        }
      });
    }

    function renderBarChart(dataObj, label, title) {
      const sorted = Object.entries(dataObj)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      return new Chart(ctx, {
        type: 'bar',
        data: {
          labels: sorted.map(entry => entry[0]),
          datasets: [{
            label: label,
            data: sorted.map(entry => entry[1]),
            backgroundColor: 'rgba(75, 192, 192, 0.6)'
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              display: false
            },
            title: {
              display: true,
              text: title
            },
            datalabels: {
              anchor: 'end',
              align: 'top',
              font: {
                weight: 'bold'
              },
              formatter: Math.round
            }
          },
          scales: {
            x: {
              ticks: {
                autoSkip: false,
                maxRotation: 45,
                minRotation: 45
              }
            }
          }
        },
        plugins: [ChartDataLabels]
      });
    }

    chartFunctions.push(
      () => renderBarChart(countryCounts, 'Country Count', 'Country Distribution (Top 10)'),
      () => renderBarChart(regionCounts, 'Region Count', 'Region Distribution (Top 10)'),
      () => renderBarChart(waterSourceCounts, 'Water Source Count', 'Water Source Type Distribution (Top 10)'),
      () => renderBarChart(treatmentCounts, 'Treatment Method Count', 'Water Treatment Method Distribution (Top 10)')
    );

    currentChart = chartFunctions[chartIndex]();

    document.getElementById('nextArrow').addEventListener('click', () => {
      if (currentChart) currentChart.destroy();
      chartIndex = (chartIndex + 1) % chartFunctions.length;
      currentChart = chartFunctions[chartIndex]();
    });

    document.getElementById('prevArrow').addEventListener('click', () => {
      if (currentChart) currentChart.destroy();
      chartIndex = (chartIndex - 1 + chartFunctions.length) % chartFunctions.length;
      currentChart = chartFunctions[chartIndex]();
    });
  });

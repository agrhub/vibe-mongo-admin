export const seriesColors = ['#409eff', '#67c23a', '#e6a23c', '#f56c6c', '#9b59b6'];

export interface ChartSpec {
  title: string;
  description?: string;
  chartType: string;
  labelField?: string;
  valueField?: string;
}

export function buildChartOption(spec: ChartSpec, results: any[], isDarkTheme: boolean = true) {
  if (!results || results.length === 0) return {};

  const keys = Object.keys(results[0]).filter(k => k !== '_id');
  if (keys.length === 0) return {};

  const aiLabel = spec.labelField && keys.includes(spec.labelField) ? spec.labelField : null;
  const aiValue = spec.valueField && keys.includes(spec.valueField) ? spec.valueField : null;

  const stringKeys = keys.filter(k => typeof results[0][k] === 'string' || typeof results[0][k] === 'boolean');
  const numericKeys = keys.filter(k => typeof results[0][k] === 'number');

  const labelKey: string = aiLabel || stringKeys[0] || keys[0];
  const valueKey: string = aiValue || numericKeys.find(k => k !== labelKey) || numericKeys[0] || keys.find(k => k !== labelKey) || keys[1] || keys[0];

  const textColor = isDarkTheme ? '#ccc' : '#333';
  const axisColor = isDarkTheme ? '#aaa' : '#666';
  const splitLineColor = isDarkTheme ? '#333' : '#eee';

  if (spec.chartType === 'pie') {
    return {
      title: { text: spec.title, left: 'center', textStyle: { color: textColor, fontSize: 14 } },
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      series: [{
        type: 'pie',
        radius: ['35%', '65%'],
        center: ['50%', '55%'],
        data: results.slice(0, 12).map((r: any, idx: number) => ({
          name: String(r[labelKey] ?? 'null').slice(0, 30),
          value: r[valueKey] ?? 0,
          itemStyle: { color: seriesColors[idx % seriesColors.length] }
        })),
        label: { color: textColor, fontSize: 11 },
        emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' } }
      }],
      backgroundColor: 'transparent'
    };
  } else if (spec.chartType === 'line') {
    return {
      title: { text: spec.title, left: 'center', textStyle: { color: textColor, fontSize: 14 } },
      tooltip: { trigger: 'axis' },
      grid: { left: '3%', right: '4%', bottom: '8%', containLabel: true },
      xAxis: {
        type: 'category',
        data: results.slice(0, 30).map((r: any) => String(r[labelKey] ?? '').slice(0, 20)),
        axisLabel: { color: axisColor, fontSize: 10, rotate: 20 },
        axisLine: { lineStyle: { color: isDarkTheme ? '#444' : '#ccc' } }
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: axisColor },
        splitLine: { lineStyle: { color: splitLineColor } }
      },
      series: numericKeys.slice(0, 3).map((nk, idx) => ({
        name: nk,
        type: 'line',
        smooth: true,
        data: results.slice(0, 30).map((r: any) => r[nk] ?? 0),
        lineStyle: { color: seriesColors[idx % seriesColors.length], width: 2 },
        itemStyle: { color: seriesColors[idx % seriesColors.length] },
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [
          { offset: 0, color: seriesColors[idx % seriesColors.length] + '40' },
          { offset: 1, color: 'transparent' }
        ]}}
      })),
      backgroundColor: 'transparent'
    };
  } else {
    // Default: bar chart
    return {
      title: { text: spec.title, left: 'center', textStyle: { color: textColor, fontSize: 14 } },
      tooltip: { trigger: 'axis' },
      grid: { left: '3%', right: '4%', bottom: '8%', containLabel: true },
      xAxis: {
        type: 'category',
        data: results.slice(0, 20).map((r: any) => String(r[labelKey] ?? '').slice(0, 20)),
        axisLabel: { color: axisColor, fontSize: 10, rotate: 25 },
        axisLine: { lineStyle: { color: isDarkTheme ? '#444' : '#ccc' } }
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: axisColor },
        splitLine: { lineStyle: { color: splitLineColor } }
      },
      series: numericKeys.slice(0, 3).map((nk, idx) => ({
        name: nk,
        type: 'bar',
        data: results.slice(0, 20).map((r: any) => r[nk] ?? 0),
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: seriesColors[idx % seriesColors.length] },
              { offset: 1, color: seriesColors[idx % seriesColors.length] + '60' }
            ]
          }
        },
        barMaxWidth: 40
      })),
      backgroundColor: 'transparent'
    };
  }
}

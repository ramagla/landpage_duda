import {
    useEffect,
    useRef,
} from 'react'

import {
    BarChart,
    GaugeChart,
    PieChart,
} from 'echarts/charts'
import {
    GridComponent,
    TooltipComponent,
} from 'echarts/components'
import {
    init,
    use as registerECharts,
} from 'echarts/core'
import {
    CanvasRenderer,
} from 'echarts/renderers'

registerECharts([
    BarChart,
    GaugeChart,
    PieChart,
    GridComponent,
    TooltipComponent,
    CanvasRenderer,
])


export default function FinanceChart({
    option,
    className = '',
    ariaLabel,
}) {
    const elementRef =
        useRef(null)

    useEffect(() => {
        if (!elementRef.current) {
            return undefined
        }

        const chart =
            init(elementRef.current)

        chart.setOption(option, true)

        const resize = () => {
            chart.resize()
        }

        window.addEventListener(
            'resize',
            resize,
        )

        const observer =
            new ResizeObserver(resize)

        observer.observe(elementRef.current)

        return () => {
            window.removeEventListener(
                'resize',
                resize,
            )
            observer.disconnect()
            chart.dispose()
        }
    }, [option])

    return (
        <div
            ref={elementRef}
            className={`finance-chart ${className}`.trim()}
            role="img"
            aria-label={ariaLabel}
        />
    )
}

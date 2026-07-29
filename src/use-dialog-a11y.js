import {
    useEffect,
    useRef,
} from 'react'

const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(',')

export function useDialogA11y(
    open,
    onClose,
) {
    const dialogRef = useRef(null)
    const closeRef = useRef(onClose)

    useEffect(() => {
        closeRef.current = onClose
    }, [onClose])

    useEffect(() => {
        if (!open) {
            return undefined
        }

        const dialog =
            dialogRef.current

        const previouslyFocused =
            document.activeElement

        const focusable = () => (
            Array.from(
                dialog?.querySelectorAll(
                    FOCUSABLE_SELECTOR,
                ) || [],
            )
        )

        window.requestAnimationFrame(() => {
            focusable()[0]
                ?.focus()
        })

        function handleKeyDown(event) {
            if (event.key === 'Escape') {
                event.preventDefault()
                closeRef.current?.()
                return
            }

            if (event.key !== 'Tab') {
                return
            }

            const elements =
                focusable()

            if (elements.length === 0) {
                event.preventDefault()
                return
            }

            const first =
                elements[0]
            const last =
                elements[elements.length - 1]

            if (
                event.shiftKey
                && document.activeElement === first
            ) {
                event.preventDefault()
                last.focus()
            } else if (
                !event.shiftKey
                && document.activeElement === last
            ) {
                event.preventDefault()
                first.focus()
            }
        }

        document.addEventListener(
            'keydown',
            handleKeyDown,
        )

        return () => {
            document.removeEventListener(
                'keydown',
                handleKeyDown,
            )

            previouslyFocused
                ?.focus?.()
        }
    }, [open])

    return dialogRef
}

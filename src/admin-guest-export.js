const textEncoder = new TextEncoder()

function asKnownAge(value) {
    if (
        value === ''
        || value === null
        || value === undefined
    ) {
        return null
    }

    const age = Number(value)

    return Number.isFinite(age)
        ? age
        : null
}

export function getGuestInvitationAges(guest) {
    return [
        guest?.age,
        ...(guest?.companions || [])
            .map((item) => item.age),
        ...(guest?.presetCompanions || [])
            .map((item) => item.age),
    ]
        .map(asKnownAge)
        .filter((age) => age !== null)
}

export function guestMatchesAgeFilter(
    guest,
    filter,
) {
    if (
        !filter
        || filter === 'todos'
    ) {
        return true
    }

    const ages =
        getGuestInvitationAges(guest)

    if (filter === 'ate6') {
        return ages.some(
            (age) => age <= 6,
        )
    }

    if (filter === 'acima6') {
        return ages.some(
            (age) => age > 6,
        )
    }

    if (filter === 'sem_idade') {
        return ages.length === 0
    }

    return true
}

function xmlEscape(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&apos;')
}

function excelColumnName(index) {
    let current = index + 1
    let name = ''

    while (current > 0) {
        const remainder =
            (current - 1) % 26

        name =
            String.fromCharCode(
                65 + remainder,
            )
            + name

        current =
            Math.floor(
                (current - 1) / 26,
            )
    }

    return name
}

function createWorksheetXml(
    columns,
    rows,
) {
    const lastColumn =
        excelColumnName(
            columns.length - 1,
        )

    const headerCells = columns
        .map((column, index) => {
            const reference =
                `${excelColumnName(index)}1`

            return (
                `<c r="${reference}" t="inlineStr" s="1">`
                + `<is><t>${xmlEscape(column.label)}</t></is>`
                + '</c>'
            )
        })
        .join('')

    const bodyRows = rows
        .map((row, rowIndex) => {
            const excelRow =
                rowIndex + 2

            const cells = columns
                .map((column, columnIndex) => {
                    const reference =
                        `${excelColumnName(columnIndex)}${excelRow}`

                    const value =
                        row[column.key] ?? ''

                    return (
                        `<c r="${reference}" t="inlineStr" s="2">`
                        + `<is><t xml:space="preserve">${xmlEscape(value)}</t></is>`
                        + '</c>'
                    )
                })
                .join('')

            return (
                `<row r="${excelRow}">${cells}</row>`
            )
        })
        .join('')

    const columnDefinitions = columns
        .map((column, index) => {
            const position = index + 1
            const width =
                Number(column.xlsxWidth)
                || 18

            return (
                `<col min="${position}" max="${position}" width="${width}" customWidth="1"/>`
            )
        })
        .join('')

    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        + `<dimension ref="A1:${lastColumn}${Math.max(rows.length + 1, 1)}"/>`
        + `<cols>${columnDefinitions}</cols>`
        + '<sheetViews><sheetView workbookViewId="0">'
        + '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>'
        + '</sheetView></sheetViews>'
        + '<sheetFormatPr defaultRowHeight="18"/>'
        + `<sheetData><row r="1" ht="25" customHeight="1">${headerCells}</row>${bodyRows}</sheetData>`
        + `<autoFilter ref="A1:${lastColumn}${Math.max(rows.length + 1, 1)}"/>`
        + '</worksheet>'
    )
}

function createStylesXml() {
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        + '<fonts count="2">'
        + '<font><sz val="10"/><name val="Aptos"/></font>'
        + '<font><b/><color rgb="FFFFFFFF"/><sz val="10"/><name val="Aptos Display"/></font>'
        + '</fonts>'
        + '<fills count="3">'
        + '<fill><patternFill patternType="none"/></fill>'
        + '<fill><patternFill patternType="gray125"/></fill>'
        + '<fill><patternFill patternType="solid"><fgColor rgb="FF08786F"/><bgColor indexed="64"/></patternFill></fill>'
        + '</fills>'
        + '<borders count="2">'
        + '<border><left/><right/><top/><bottom/><diagonal/></border>'
        + '<border>'
        + '<left style="thin"><color rgb="FFD8E7E3"/></left>'
        + '<right style="thin"><color rgb="FFD8E7E3"/></right>'
        + '<top style="thin"><color rgb="FFD8E7E3"/></top>'
        + '<bottom style="thin"><color rgb="FFD8E7E3"/></bottom>'
        + '<diagonal/>'
        + '</border>'
        + '</borders>'
        + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
        + '<cellXfs count="3">'
        + '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
        + '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>'
        + '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>'
        + '</cellXfs>'
        + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
        + '</styleSheet>'
    )
}

function crc32(bytes) {
    let crc = 0xFFFFFFFF

    for (const byte of bytes) {
        crc ^= byte

        for (
            let bit = 0;
            bit < 8;
            bit += 1
        ) {
            crc = (
                crc >>> 1
            ) ^ (
                (crc & 1)
                    ? 0xEDB88320
                    : 0
            )
        }
    }

    return (crc ^ 0xFFFFFFFF) >>> 0
}

function concatBytes(parts) {
    const length = parts.reduce(
        (total, part) => (
            total + part.length
        ),
        0,
    )

    const result =
        new Uint8Array(length)

    let offset = 0

    for (const part of parts) {
        result.set(part, offset)
        offset += part.length
    }

    return result
}

function createZipHeader(
    length,
    writer,
) {
    const bytes =
        new Uint8Array(length)

    writer(
        new DataView(
            bytes.buffer,
        ),
    )

    return bytes
}

function createStoredZip(files) {
    const localParts = []
    const centralParts = []
    let localOffset = 0

    for (const file of files) {
        const nameBytes =
            textEncoder.encode(file.name)

        const contentBytes =
            typeof file.content === 'string'
                ? textEncoder.encode(
                    file.content,
                )
                : file.content

        const checksum =
            crc32(contentBytes)

        const localHeader =
            createZipHeader(
                30,
                (view) => {
                    view.setUint32(
                        0,
                        0x04034B50,
                        true,
                    )
                    view.setUint16(4, 20, true)
                    view.setUint16(6, 0x0800, true)
                    view.setUint16(8, 0, true)
                    view.setUint16(10, 0, true)
                    view.setUint16(12, 0, true)
                    view.setUint32(14, checksum, true)
                    view.setUint32(
                        18,
                        contentBytes.length,
                        true,
                    )
                    view.setUint32(
                        22,
                        contentBytes.length,
                        true,
                    )
                    view.setUint16(
                        26,
                        nameBytes.length,
                        true,
                    )
                    view.setUint16(28, 0, true)
                },
            )

        const centralHeader =
            createZipHeader(
                46,
                (view) => {
                    view.setUint32(
                        0,
                        0x02014B50,
                        true,
                    )
                    view.setUint16(4, 20, true)
                    view.setUint16(6, 20, true)
                    view.setUint16(8, 0x0800, true)
                    view.setUint16(10, 0, true)
                    view.setUint16(12, 0, true)
                    view.setUint16(14, 0, true)
                    view.setUint32(16, checksum, true)
                    view.setUint32(
                        20,
                        contentBytes.length,
                        true,
                    )
                    view.setUint32(
                        24,
                        contentBytes.length,
                        true,
                    )
                    view.setUint16(
                        28,
                        nameBytes.length,
                        true,
                    )
                    view.setUint16(30, 0, true)
                    view.setUint16(32, 0, true)
                    view.setUint16(34, 0, true)
                    view.setUint16(36, 0, true)
                    view.setUint32(38, 0, true)
                    view.setUint32(
                        42,
                        localOffset,
                        true,
                    )
                },
            )

        localParts.push(
            localHeader,
            nameBytes,
            contentBytes,
        )

        centralParts.push(
            centralHeader,
            nameBytes,
        )

        localOffset += (
            localHeader.length
            + nameBytes.length
            + contentBytes.length
        )
    }

    const centralDirectory =
        concatBytes(centralParts)

    const endRecord =
        createZipHeader(
            22,
            (view) => {
                view.setUint32(
                    0,
                    0x06054B50,
                    true,
                )
                view.setUint16(4, 0, true)
                view.setUint16(6, 0, true)
                view.setUint16(
                    8,
                    files.length,
                    true,
                )
                view.setUint16(
                    10,
                    files.length,
                    true,
                )
                view.setUint32(
                    12,
                    centralDirectory.length,
                    true,
                )
                view.setUint32(
                    16,
                    localOffset,
                    true,
                )
                view.setUint16(20, 0, true)
            },
        )

    return concatBytes([
        ...localParts,
        centralDirectory,
        endRecord,
    ])
}

export function createGuestsXlsx({
    columns,
    rows,
    sheetName = 'Convidados',
}) {
    const safeSheetName = String(
        sheetName || 'Convidados',
    )
        .replace(/[\\/*?:[\]]/g, ' ')
        .slice(0, 31)

    const worksheet =
        createWorksheetXml(
            columns,
            rows,
        )

    const files = [
        {
            name: '[Content_Types].xml',
            content: (
                '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
                + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
                + '<Default Extension="xml" ContentType="application/xml"/>'
                + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
                + '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
                + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
                + '</Types>'
            ),
        },
        {
            name: '_rels/.rels',
            content: (
                '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
                + '</Relationships>'
            ),
        },
        {
            name: 'xl/workbook.xml',
            content: (
                '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
                + `<sheets><sheet name="${xmlEscape(safeSheetName)}" sheetId="1" r:id="rId1"/></sheets>`
                + '</workbook>'
            ),
        },
        {
            name: 'xl/_rels/workbook.xml.rels',
            content: (
                '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
                + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
                + '</Relationships>'
            ),
        },
        {
            name: 'xl/styles.xml',
            content: createStylesXml(),
        },
        {
            name: 'xl/worksheets/sheet1.xml',
            content: worksheet,
        },
    ]

    return createStoredZip(files)
}

const winAnsiExtras = new Map([
    [0x20AC, 0x80],
    [0x201A, 0x82],
    [0x0192, 0x83],
    [0x201E, 0x84],
    [0x2026, 0x85],
    [0x2020, 0x86],
    [0x2021, 0x87],
    [0x02C6, 0x88],
    [0x2030, 0x89],
    [0x0160, 0x8A],
    [0x2039, 0x8B],
    [0x0152, 0x8C],
    [0x017D, 0x8E],
    [0x2018, 0x91],
    [0x2019, 0x92],
    [0x201C, 0x93],
    [0x201D, 0x94],
    [0x2022, 0x95],
    [0x2013, 0x96],
    [0x2014, 0x97],
    [0x02DC, 0x98],
    [0x2122, 0x99],
    [0x0161, 0x9A],
    [0x203A, 0x9B],
    [0x0153, 0x9C],
    [0x017E, 0x9E],
    [0x0178, 0x9F],
])

function pdfText(value) {
    let result = ''

    for (
        const character of String(value ?? '')
    ) {
        const codePoint =
            character.codePointAt(0)

        let byte = codePoint

        if (
            codePoint > 255
            && winAnsiExtras.has(codePoint)
        ) {
            byte =
                winAnsiExtras.get(codePoint)
        } else if (codePoint > 255) {
            const fallback = character
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')

            byte = fallback.length === 1
                ? fallback.charCodeAt(0)
                : 63
        }

        if (
            byte === 40
            || byte === 41
            || byte === 92
        ) {
            result +=
                `\\${String.fromCharCode(byte)}`
        } else if (
            byte < 32
            || byte > 126
        ) {
            result +=
                `\\${byte
                    .toString(8)
                    .padStart(3, '0')}`
        } else {
            result +=
                String.fromCharCode(byte)
        }
    }

    return result
}

function wrapPdfText(
    value,
    maxCharacters,
    maxLines = 5,
) {
    const normalized = String(
        value ?? '',
    )
        .replace(/\s+/g, ' ')
        .trim()

    if (!normalized) {
        return ['']
    }

    const words =
        normalized.split(' ')

    const lines = []
    let current = ''

    for (const word of words) {
        const candidate = current
            ? `${current} ${word}`
            : word

        if (
            candidate.length
            <= maxCharacters
        ) {
            current = candidate
            continue
        }

        if (current) {
            lines.push(current)
        }

        current = word

        if (
            lines.length
            === maxLines - 1
        ) {
            break
        }
    }

    if (
        current
        && lines.length < maxLines
    ) {
        lines.push(current)
    }

    const consumed =
        lines.join(' ').length

    if (
        consumed < normalized.length
        && lines.length > 0
    ) {
        const lastIndex =
            lines.length - 1

        lines[lastIndex] = (
            lines[lastIndex]
                .slice(
                    0,
                    Math.max(
                        maxCharacters - 3,
                        1,
                    ),
                )
            + '...'
        )
    }

    return lines
}

function pdfTextCommand({
    text,
    x,
    y,
    font = 'F1',
    size = 8,
    color = '0.18 0.24 0.23',
}) {
    return (
        'BT '
        + `${color} rg `
        + `/${font} ${size} Tf `
        + `1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm `
        + `(${pdfText(text)}) Tj ET\n`
    )
}

function latin1Bytes(value) {
    const bytes =
        new Uint8Array(value.length)

    for (
        let index = 0;
        index < value.length;
        index += 1
    ) {
        bytes[index] =
            value.charCodeAt(index)
            & 0xFF
    }

    return bytes
}

function buildPdfDocument(
    pageStreams,
) {
    const pageObjectIds = []
    const contentObjectIds = []

    let nextObjectId = 5

    for (
        let index = 0;
        index < pageStreams.length;
        index += 1
    ) {
        pageObjectIds.push(nextObjectId)
        contentObjectIds.push(
            nextObjectId + 1,
        )
        nextObjectId += 2
    }

    const objects = new Map([
        [
            1,
            '<< /Type /Catalog /Pages 2 0 R >>',
        ],
        [
            2,
            (
                '<< /Type /Pages '
                + `/Count ${pageStreams.length} `
                + `/Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] `
                + '>>'
            ),
        ],
        [
            3,
            '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
        ],
        [
            4,
            '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
        ],
    ])

    pageStreams.forEach(
        (stream, index) => {
            const pageId =
                pageObjectIds[index]

            const contentId =
                contentObjectIds[index]

            objects.set(
                pageId,
                (
                    '<< /Type /Page /Parent 2 0 R '
                    + '/MediaBox [0 0 842 595] '
                    + '/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> '
                    + `/Contents ${contentId} 0 R >>`
                ),
            )

            objects.set(
                contentId,
                (
                    `<< /Length ${stream.length} >>\n`
                    + `stream\n${stream}endstream`
                ),
            )
        },
    )

    let pdf =
        '%PDF-1.4\n%âãÏÓ\n'

    const offsets = [0]
    const objectCount =
        nextObjectId - 1

    for (
        let id = 1;
        id <= objectCount;
        id += 1
    ) {
        offsets[id] = pdf.length
        pdf += (
            `${id} 0 obj\n`
            + `${objects.get(id)}\n`
            + 'endobj\n'
        )
    }

    const xrefOffset =
        pdf.length

    pdf += (
        `xref\n0 ${objectCount + 1}\n`
        + '0000000000 65535 f \n'
    )

    for (
        let id = 1;
        id <= objectCount;
        id += 1
    ) {
        pdf += (
            `${String(offsets[id]).padStart(10, '0')} 00000 n \n`
        )
    }

    pdf += (
        'trailer\n'
        + `<< /Size ${objectCount + 1} /Root 1 0 R >>\n`
        + 'startxref\n'
        + `${xrefOffset}\n`
        + '%%EOF'
    )

    return latin1Bytes(pdf)
}

export function createGuestsPdf({
    title,
    subtitle,
    filterDescription,
    columns,
    rows,
}) {
    const pageWidth = 842
    const pageHeight = 595
    const margin = 28
    const tableWidth =
        pageWidth - (margin * 2)

    const totalColumnWidth = columns
        .reduce(
            (sum, column) => (
                sum + column.pdfWidth
            ),
            0,
        )

    const widthScale =
        tableWidth / totalColumnWidth

    const normalizedColumns = columns
        .map((column) => ({
            ...column,
            width:
                column.pdfWidth
                * widthScale,
        }))

    const pages = []
    let commands = ''
    let cursorY = 0
    let rowIndex = 0

    function drawPageHeader() {
        commands += (
            `0.03 0.47 0.43 rg 0 ${pageHeight - 68} ${pageWidth} 68 re f\n`
        )

        commands += pdfTextCommand({
            text: title,
            x: margin,
            y: pageHeight - 31,
            font: 'F2',
            size: 16,
            color: '1 1 1',
        })

        commands += pdfTextCommand({
            text: subtitle,
            x: margin,
            y: pageHeight - 49,
            size: 8,
            color: '0.86 0.97 0.94',
        })

        commands += pdfTextCommand({
            text: filterDescription,
            x: margin,
            y: pageHeight - 82,
            font: 'F2',
            size: 7.5,
            color: '0.22 0.36 0.33',
        })

        const headerTop =
            pageHeight - 96

        commands += (
            `0.09 0.39 0.36 rg ${margin} ${headerTop - 24} ${tableWidth} 24 re f\n`
        )

        let x = margin

        for (
            const column
            of normalizedColumns
        ) {
            commands += pdfTextCommand({
                text: column.label,
                x: x + 4,
                y: headerTop - 15,
                font: 'F2',
                size: 7,
                color: '1 1 1',
            })

            x += column.width
        }

        cursorY =
            headerTop - 24
    }

    function finishPage() {
        pages.push(commands)
        commands = ''
        drawPageHeader()
    }

    drawPageHeader()

    for (const row of rows) {
        const cells = normalizedColumns
            .map((column) => {
                const maxCharacters =
                    Math.max(
                        Math.floor(
                            column.width / 4.25,
                        ),
                        5,
                    )

                return wrapPdfText(
                    row[column.key],
                    maxCharacters,
                    column.pdfLines || 4,
                )
            })

        const rowHeight = Math.max(
            22,
            (
                Math.max(
                    ...cells.map(
                        (lines) => (
                            lines.length
                        ),
                    ),
                )
                * 9
            ) + 8,
        )

        if (
            cursorY - rowHeight
            < 34
        ) {
            finishPage()
        }

        if (rowIndex % 2 === 0) {
            commands += (
                `0.96 0.98 0.97 rg ${margin} ${cursorY - rowHeight} ${tableWidth} ${rowHeight} re f\n`
            )
        }

        commands += (
            `0.80 0.88 0.86 RG 0.45 w ${margin} ${cursorY - rowHeight} ${tableWidth} ${rowHeight} re S\n`
        )

        let x = margin

        normalizedColumns.forEach(
            (column, columnIndex) => {
                const lines =
                    cells[columnIndex]

                lines.forEach(
                    (line, lineIndex) => {
                        commands += pdfTextCommand({
                            text: line,
                            x: x + 4,
                            y: cursorY - 13 - (lineIndex * 9),
                            font:
                                columnIndex === 0
                                    ? 'F2'
                                    : 'F1',
                            size: 7.2,
                        })
                    },
                )

                x += column.width
            },
        )

        cursorY -= rowHeight
        rowIndex += 1
    }

    pages.push(commands)

    const totalPages =
        pages.length

    const streams = pages.map(
        (pageCommands, index) => (
            pageCommands
            + pdfTextCommand({
                text:
                    `Página ${index + 1} de ${totalPages} · ${rows.length} registro${rows.length === 1 ? '' : 's'}`,
                x: margin,
                y: 17,
                size: 7,
                color: '0.38 0.48 0.46',
            })
        ),
    )

    return buildPdfDocument(
        streams,
    )
}

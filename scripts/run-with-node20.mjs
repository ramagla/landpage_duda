import {
    spawn,
} from 'node:child_process'

const REQUIRED_VERSION = [
    20,
    19,
    0,
]

function parseVersion(version) {
    return String(version)
        .split('.')
        .map((part) => Number.parseInt(part, 10) || 0)
}

function isAtLeast(
    current,
    required,
) {
    for (let index = 0; index < required.length; index += 1) {
        if (current[index] > required[index]) {
            return true
        }

        if (current[index] < required[index]) {
            return false
        }
    }

    return true
}

const args =
    process.argv.slice(2)

if (args.length === 0) {
    console.error(
        'Informe o comando Node que deve ser executado.'
    )
    process.exit(1)
}

const currentVersion =
    parseVersion(process.versions.node)

const command =
    isAtLeast(
        currentVersion,
        REQUIRED_VERSION,
    )
        ? process.execPath
        : 'npx'

const commandArgs =
    command === process.execPath
        ? args
        : [
            '-y',
            'node@20.19.0',
            ...args,
        ]

const child =
    spawn(
        command,
        commandArgs,
        {
            stdio: 'inherit',
            shell: process.platform === 'win32',
        },
    )

child.on(
    'exit',
    (code, signal) => {
        if (signal) {
            process.kill(
                process.pid,
                signal,
            )
            return
        }

        process.exit(code ?? 1)
    },
)

child.on(
    'error',
    (error) => {
        console.error(error.message)
        process.exit(1)
    },
)

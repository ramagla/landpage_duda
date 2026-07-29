import AxeBuilder from '@axe-core/playwright'
import {
    expect,
    test,
} from '@playwright/test'

const OPENING_SESSION = {
    invitationCode: '',
    guest: {
        id: 1,
        name: 'Convidada de teste',
        age: 30,
        maxCompanions: 2,
        companions: [
            {
                slot: 1,
                name: 'Acompanhante teste',
                age: 5,
                attending: 'sim',
            },
            {
                slot: 2,
                name: '',
                age: '',
                attending: 'sim',
            },
        ],
    },
    whatsapp: '11999999999',
    alreadyConfirmed: false,
    rsvp: null,
}

async function blockExternalMedia(page) {
    await page.route(
        /youtube|googlevideo/,
        (route) => route.abort(),
    )
}

async function unlockInvitation(page) {
    await page.addInitScript((openingSession) => {
        window.sessionStorage.setItem(
            'dudaInvitationUnlocked',
            JSON.stringify(openingSession),
        )
    }, OPENING_SESSION)
}

test('a abertura móvel usa a nova identidade sem rolagem horizontal', async ({
    page,
}) => {
    await blockExternalMedia(page)
    await page.goto('/')

    await expect(
        page.getByText('Duda', { exact: true }),
    ).toBeVisible()

    const openingStyle =
        await page.locator('.opening-gate__brand span')
            .evaluate((element) => {
                const style =
                    getComputedStyle(element)

                return {
                    fontFamily:
                        style.fontFamily,
                    color:
                        style.color,
                }
            })

    expect(openingStyle.fontFamily)
        .toContain('Parisienne')
    expect(openingStyle.color)
        .toBe('rgb(0, 112, 106)')

    const overflow =
        await page.evaluate(() => (
            document.documentElement.scrollWidth
            - document.documentElement.clientWidth
        ))

    expect(overflow)
        .toBeLessThanOrEqual(1)

    await expect(
        page.locator('.opening-gate__balloon'),
    ).toHaveAttribute(
        'src',
        '/media/balloon-16.webp',
    )

    await expect(
        page.locator('meta[property="og:image"]'),
    ).toHaveAttribute(
        'content',
        'https://www.dudanoibiza.com.br/og-convite-duda-v2.jpg',
    )
})

test('o convite interno é simétrico e oferece calendário do iPhone', async ({
    page,
}) => {
    await blockExternalMedia(page)
    await unlockInvitation(page)
    await page.goto('/')

    const dateCard =
        page.locator('.event-details > div')
            .nth(0)
    const timeCard =
        page.locator('.event-details > div')
            .nth(1)

    await expect(dateCard)
        .toBeVisible()
    await expect(timeCard)
        .toBeVisible()

    const publicPalette =
        await page.locator('.page-shell--revealed')
            .evaluate((element) => {
                const primaryButton =
                    element.querySelector(
                        '.hero-quick-actions__primary',
                    )
                const styleSection =
                    element.querySelector('.style-section')

                return {
                    accent:
                        getComputedStyle(element)
                            .getPropertyValue('--invite-wine')
                            .trim(),
                    primaryBackground:
                        getComputedStyle(primaryButton)
                            .backgroundImage,
                    styleBackground:
                        getComputedStyle(styleSection)
                            .backgroundImage,
                }
            })

    expect(publicPalette.accent)
        .toBe('#086c67')
    expect(publicPalette.primaryBackground)
        .toContain('rgb(11, 129, 122)')
    expect(publicPalette.styleBackground)
        .toContain('rgb(8, 108, 103)')

    const [dateBox, timeBox] =
        await Promise.all([
            dateCard.boundingBox(),
            timeCard.boundingBox(),
        ])

    expect(
        Math.abs(dateBox.y - timeBox.y),
    ).toBeLessThanOrEqual(1)
    expect(
        Math.abs(dateBox.height - timeBox.height),
    ).toBeLessThanOrEqual(1)

    const calendarLink =
        page.getByRole(
            'link',
            {
                name: /Agenda do iPhone/i,
            },
        )

    await expect(calendarLink)
        .toBeVisible()
    await expect(calendarLink)
        .toHaveAttribute(
            'href',
            '/api/calendar?platform=ios',
        )

    await expect(
        page.getByText(
            'Como usamos seus dados',
            {
                exact: true,
            },
        ),
    ).toBeVisible()
})

test('Android recebe o atalho do Google Agenda', async ({
    browser,
}) => {
    const context =
        await browser.newContext({
            viewport: {
                width: 390,
                height: 844,
            },
            isMobile: true,
            hasTouch: true,
            userAgent:
                'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36',
        })

    const page =
        await context.newPage()

    await blockExternalMedia(page)
    await unlockInvitation(page)
    await page.goto('/')

    const calendarLink =
        page.getByRole(
            'link',
            {
                name: /Google Agenda/i,
            },
        )

    await expect(calendarLink)
        .toBeVisible()
    await expect(calendarLink)
        .toHaveAttribute(
            'href',
            /calendar\.google\.com/,
        )

    await context.close()
})

test('a tela pública não apresenta violações graves de acessibilidade', async ({
    page,
}) => {
    await blockExternalMedia(page)
    await unlockInvitation(page)
    await page.goto('/')

    const results =
        await new AxeBuilder({
            page,
        })
            .withTags([
                'wcag2a',
                'wcag2aa',
            ])
            .analyze()

    const seriousViolations =
        results.violations
            .filter(
                (violation) => (
                    violation.impact === 'serious'
                    || violation.impact === 'critical'
                ),
            )

    expect(seriousViolations)
        .toEqual([])
})

test('o admin móvel organiza as melhorias em um único menu', async ({
    page,
}) => {
    const adminData = {
        totals: {
            invited: 1,
            confirmed: 1,
            declined: 0,
            pending: 0,
            viewed: 0,
            buffet: 1,
            invitesSent: 1,
            invitesNotSent: 0,
            checkedIn: 0,
        },
        guests: [
            {
                id: 1,
                name:
                    'Convidada confirmada',
                inviteCode: 'confirmada',
                inviteToken: 'a'.repeat(64),
                age: 30,
                whatsapp:
                    '11999999999',
                maxCompanions: 0,
                status: 'sim',
                buffetCount: 1,
                companions: [],
                presetCompanions: [],
                communications: {
                    convite_inicial:
                        '2026-07-29 12:00:00',
                },
                checkins: [],
            },
        ],
        messages: [],
        auditLog: [],
        backups: [],
    }

    await page.route(
        '**/api/admin',
        (route) => route.fulfill({
            status: 200,
            contentType:
                'application/json',
            body:
                JSON.stringify(adminData),
        }),
    )

    await page.route(
        '**/api/admin-preview-session',
        (route) => route.fulfill({
            status: 200,
            contentType:
                'application/json',
            body:
                JSON.stringify({
                    authorized: true,
                }),
        }),
    )

    await page.goto('/admin')

    await expect(
        page.getByRole(
            'navigation',
            {
                name:
                    'Menu principal do painel',
            },
        ),
    ).toBeVisible()

    await expect(
        page.getByRole(
            'heading',
            {
                name:
                    'Saúde do evento',
            },
        ),
    ).toBeVisible()

    await expect(
        page.getByRole(
            'heading',
            {
                name:
                    'Backups',
            },
        ),
    ).toBeVisible()

    const menuItems = [
        ['Galeria', 'Galeria da Duda'],
        ['Prévia', 'Prévia do convite'],
        ['Comunicação', 'Envio dos convites'],
        ['Relatórios', 'Relatórios do evento'],
        ['Configurações', 'Configurações do convite'],
    ]

    for (
        const [buttonName, heading]
        of menuItems
    ) {
        await page
            .getByRole(
                'button',
                {
                    name:
                        buttonName,
                    exact: true,
                },
            )
            .click()

        await expect(
            page.getByRole(
                'heading',
                {
                    name:
                        heading,
                },
            ),
        ).toBeVisible()
    }

    await page
        .getByRole(
            'button',
            {
                name:
                    'Galeria',
                exact: true,
            },
        )
        .click()

    const uploadStyle =
        await page
            .locator('.admin-upload-photo')
            .evaluate((element) => {
                const labelStyle =
                    getComputedStyle(element)
                const textStyle =
                    getComputedStyle(
                        element.querySelector('span'),
                    )

                return {
                    background:
                        labelStyle.backgroundColor,
                    color:
                        textStyle.color,
                    text:
                        element.textContent.trim(),
                }
            })

    expect(uploadStyle.text)
        .toContain('Adicionar foto')
    expect(uploadStyle.background)
        .toBe('rgb(8, 116, 111)')
    expect(uploadStyle.color)
        .toBe('rgb(255, 255, 255)')

    await page
        .getByRole(
            'button',
            {
                name:
                    'Prévia',
                exact: true,
            },
        )
        .click()

    await expect(
        page
            .frameLocator(
                'iframe[title="Prévia completa do convite"]',
            )
            .getByRole(
                'heading',
                {
                    name:
                        'Nosso encontro',
                },
            ),
    ).toBeVisible()

    await page
        .getByRole(
            'button',
            {
                name:
                    'Relatórios',
                exact: true,
            },
        )
        .click()

    await expect(
        page.getByText(
            'Adultos confirmados',
            {
                exact: true,
            },
        ),
    ).toBeVisible()

    await page.context().setOffline(true)

    await page
        .getByRole(
            'button',
            {
                name:
                    'Registrar entrada',
            },
        )
        .click()

    await expect(
        page.getByText(
            '1 alteração aguardando internet',
            {
                exact: true,
            },
        ),
    ).toBeVisible()

    await page.context().setOffline(false)

    const overflow =
        await page.evaluate(() => (
            document.documentElement.scrollWidth
            - document.documentElement.clientWidth
        ))

    expect(overflow)
        .toBeLessThanOrEqual(1)
})

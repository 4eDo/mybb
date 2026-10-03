console.group("4eDo script loadPostById v1.2");
console.log("%c~~ Скрипт для загрузки сообщения по pid. %c https://github.com/4eDo ~~", "font-weight: bold;", "font-weight: bold;");
console.log("More info: https://github.com/4eDo/mybb/tree/main/loadPostById# ");
console.groupEnd();

// При загрузке тега на странице...
jQuery(document).on('custom_tag', function(e) {
    if (e.tag !== 'postById') return;

    var $el = e.sender;
    var val = $el.attr('data-value');
    var tagId = $el.attr('id');

    lpbi(val, tagId);
});

async function lpbi(MSG_ID, targetId) {
    console.log('[loadPostById] lpbi вызван:', MSG_ID, targetId);

    const result = document.getElementById(targetId);
    if (!result) {
        console.error(`[loadPostById] Элемент с id="${targetId}" не найден`);
        return;
    }

    const url = `/api.php?method=post.get&fields=message&post_id=${MSG_ID}`;

    try {
        const res = await fetch(url);
        const text = await res.text();

        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.error("[loadPostById] не удалось распарсить JSON:", e);
            renderError_lpbi(result, MSG_ID, "ответ не JSON");
            return;
        }

        const message = data?.response?.[0]?.message || "";

        // 1) Декодируем &lt; &gt; &quot; и т.п.
        const txt = document.createElement("textarea");
        txt.innerHTML = message;
        let html = txt.value;

        // 2) Меняем [html]...[/html] и [indent].
        html = replaceCustomTags_lpbi(html, targetId+"inner");

        result.innerHTML = html;
    } catch (err) {
        console.error("[loadPostById] FETCH УПАЛ:", err);
        renderError(result, MSG_ID, err.message);
    }
}

/**
 * Рендерит сообщение об ошибке со ссылкой на пост.
 * @param {HTMLElement} container
 * @param {string|number} MSG_ID
 * @param {string} [reason]
 */
function renderError_lpbi(container, MSG_ID, reason) {
    const href = `/viewtopic.php?pid=${MSG_ID}#p${MSG_ID}`;
    const reasonHtml = reason
        ? ' <span style="opacity:.7">(' + escapeHtml(reason) + ')</span>'
        : '';

    container.innerHTML =
        'Не удалось встроить фрагмент. Вы можете посмотреть его ' +
        '<a href="' + href + '" target="_blank">ЗДЕСЬ</a>.' +
        reasonHtml;
}

function escapeHtml_lpbi(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Заменяет теги на HTML.
 * @param {string} html     — исходный HTML
 * @param {string} scopeId  — id контейнера, к которому скоупим стили
 */
function replaceCustomTags_lpbi(html, scopeId) {
    html = html.replace(/\[html\]([\s\S]*?)\[\/html\]/g, function (_, inner) {
        const scoped = scopeStyles_lpbi(inner, scopeId);

        return '<div class="html-post-box" style="padding-bottom:1em">' +
            '<div class="html-inner">' +
            '<div class="html-content" id="' + scopeId + '">' +
            scoped +
            '</div>' +
            '</div>' +
            '</div>';
    });

    html = html.replace(/\[indent\]/g,
        '<span style="display:inline-block;margin:0.7em 1.1em;"></span>');

    return html;
}

/**
 * Подготовка <style>...</style> для [html].
 */
function scopeStyles_lpbi(html, uuid) {
    return html.replace(/<style([^>]*)>([\s\S]*?)<\/style>/gi, function (_, attrs, css) {
        css = css.replace(/<br\s*\/?>/gi, '\n');
        const scopedCss = scopeCss_lpbi(css, uuid);
        return '<style' + attrs + '>\n' + scopedCss + '\n</style>';
    });
}

function scopeCss_lpbi(css, uuid) {
    const prefix = '#' + uuid;
    css = css.replace(/\/\*[\s\S]*?\*\//g, '');
    return parseBlocks_lpbi(css, prefix).join('\n');
}

function parseBlocks_lpbi(css, prefix) {
    const out = [];
    let i = 0;

    while (i < css.length) {
        while (i < css.length && /\s/.test(css[i])) i++;
        if (i >= css.length) break;
        let braceStart = -1;
        let j = i;
        while (j < css.length) {
            if (css[j] === '{') { braceStart = j; break; }
            j++;
        }
        if (braceStart === -1) {
            const tail = css.slice(i).trim();
            if (tail) out.push(tail);
            break;
        }

        const prelude = css.slice(i, braceStart).trim();
        let depth = 1;
        let k = braceStart + 1;
        while (k < css.length && depth > 0) {
            if (css[k] === '{') depth++;
            else if (css[k] === '}') depth--;
            k++;
        }
        const body = css.slice(braceStart + 1, k - 1);
        if (prelude.startsWith('@')) {
            const atName = (prelude.match(/^@([\w-]+)/) || [])[1] || '';

            if (/^(media|supports|document|layer|container)$/i.test(atName)) {
                const inner = parseBlocks(body, prefix).join('\n');
                out.push(prelude + ' {\n' + inner + '\n}');
            } else {
                out.push(prelude + ' {' + body + '}');
            }
        } else {
            const scopedSelectors = prelude
                .split(',')
                .map(function (sel) {
                    sel = sel.trim();
                    if (!sel) return sel;
                    if (/^(:root|html|body)$/i.test(sel)) {
                        return prefix;
                    }
                    return prefix + ' ' + sel;
                })
                .join(', ');
            out.push(scopedSelectors + ' {' + body + '}');
        }
        i = k;
    }
    return out;
}
console.group("4eDo script ep2book v1.5");
console.log("%c~~ Скрипт для сохранения эпизода как книги .epub . %c https://github.com/4eDo ~~", "font-weight: bold;", "font-weight: bold;");
console.log("More info: https://github.com/4eDo/mybb/tree/main/ep2book# ");
console.groupEnd();

(function ($) {
  'use strict';

  // ---------- Состояние ----------
  const state = {
    mode: 'single',
    links: [],
    tids: [],
    topics: {},
    topicOrder: [],
    posts: {},
    authors: [],
    loadedPosts: 0,
    totalPosts: 0,
    questions: [],
    questionSeq: 0,
    book: {
      series: '',
      title: '',
      authors: [],
      cover: null,
      coversFound: [],
      chapterTemplate: 'Глава {{num}}. {{AUTHOR}}',
      partTemplate: 'Часть {{num}}. {{SUBJECT}}',
      partNumbering: 'continuous',
      imageMap: null,
      failedImages: [],
      skipAllManualImages: false
    }
  };

  // ---------- Утилиты ----------
  function parseTid(url) {
    const m = String(url).match(/\/viewtopic\.php\?id=(\d+)/);
    return m ? m[1] : null;
  }

  function normalizeLinks(raw) {
    return String(raw).split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  }

  function setStatus($el, text, kind) {
    $el.text(text || '').removeClass('ep2book-ok ep2book-err');
    if (kind === 'ok') $el.addClass('ep2book-ok');
    if (kind === 'err') $el.addClass('ep2book-err');
  }

  function showStep(n) {
    $('#ep2book-app .ep2book-step').each(function () {
      const step = parseInt($(this).data('step'), 10);
      $(this).prop('hidden', step !== n);
    });
    $('#ep2book-app .ep2book-tab').each(function () {
      const step = parseInt($(this).data('tab'), 10);
      $(this).toggleClass('ep2book-tab-active', step === n);
      $(this).toggleClass('ep2book-tab-done', step < n);
    });
  }

  function escapeHtml_ep2book(s) {
    return String(s)
      .replace(/&/g, `&amp;`)
      .replace(/</g, `&lt;`)
      .replace(/>/g, `&gt;`)
      .replace(/"/g, `&quot;`);
  }

  function escapeAttr_ep2book(s) {
    return String(s).replace(/&/g, `&amp;`).replace(/"/g, `&quot;`).replace(/</g, `&lt;`);
  }

  function extractTids_ep2book(links) {
    const tids = [], bad = [], seen = {};
    links.forEach((url, i) => {
      const line = i + 1;
      const tid = parseTid(url);
      if (!tid) { bad.push(line); return; }
      tids.push(tid);
      if (!seen[tid]) seen[tid] = [];
      seen[tid].push(line);
    });
    const dupes = [];
    Object.keys(seen).forEach(tid => {
      if (seen[tid].length > 1) dupes.push({ tid, lines: seen[tid] });
    });
    return { tids, bad, dupes };
  }

  function recalcTotalPosts_ep2book() {
    state.totalPosts = state.tids.reduce((sum, tid) => {
      const t = state.topics[tid];
      if (!t) return sum;
      return sum + 1 + (parseInt(t.num_replies, 10) || 0);
    }, 0);
  }

  function toRoman_ep2book(num) {
    if (!num || num < 1) return ``;
    const map = [
      [1000, `M`], [900, `CM`], [500, `D`], [400, `CD`],
      [100, `C`], [90, `XC`], [50, `L`], [40, `XL`],
      [10, `X`], [9, `IX`], [5, `V`], [4, `IV`], [1, `I`]
    ];
    let n = num, out = ``;
    for (let i = 0; i < map.length; i++) {
      while (n >= map[i][0]) { out += map[i][1]; n -= map[i][0]; }
    }
    return out;
  }

  function applyTemplate_ep2book(tpl, tokens) {
    return String(tpl).replace(/\{\{\s*([a-zA-Z]+)\s*\}\}/g, function (_, key) {
      return tokens[key] != null ? String(tokens[key]) : ``;
    });
  }

  function insertAtCursor_ep2book(input, text) {
    if (!input) return;
    if (document.selection && input.selectionStart == null) {
      input.focus();
      const sel = document.selection.createRange();
      sel.text = text;
      return;
    }
    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const val = input.value;
    input.value = val.slice(0, start) + text + val.slice(end);
    const pos = start + text.length;
    input.focus();
    input.setSelectionRange(pos, pos);
  }

  // ---------- Загрузка топиков ----------
  async function fetchTopics_ep2book(tids) {
    const sdk = new MybbSDK(window.location.origin + `/`, { format: `json`, charset: `utf-8` });
    const response = await sdk.call(`topic.get`, {
      topic_id: tids,
      fields: [`id`, `subject`, `first_post`, `num_replies`]
    });
    const byId = {};
    (response || []).forEach(t => { byId[String(t.id)] = t; });
    const ordered = [], missing = [];
    tids.forEach(tid => {
      const t = byId[String(tid)];
      if (!t) { missing.push(tid); return; }
      ordered.push({
        id: String(t.id),
        subject: t.subject || ``,
        first_post: String(t.first_post || ``),
        num_replies: parseInt(t.num_replies, 10) || 0
      });
    });
    if (missing.length) console.warn(`ep2book: не найдены топики`, missing);
    return ordered;
  }

  async function loadTopics_ep2book(tids) {
    const ordered = await fetchTopics_ep2book(tids);
    ordered.forEach(t => { state.topics[t.id] = t; });
    state.tids = ordered.map(t => t.id);
    state.topicOrder = state.tids.slice();
    recalcTotalPosts_ep2book();
    return ordered;
  }

  // ---------- Загрузка постов ----------
  async function getAllPostsInTopic_ep2book(topicId, totalPostsInTopic) {
    const sdk = new MybbSDK(window.location.origin + `/`, { format: `json`, charset: `utf-8` });
    const limit = 50;
    const requestsNeeded = Math.ceil(totalPostsInTopic / limit);
    const allPosts = [];
    for (let page = 0; page < requestsNeeded; page++) {
      const skip = page * limit;
      const postsResponse = await sdk.call(`post.get`, {
        topic_id: topicId,
        fields: [`id`, `message`, `posted`, `topic_id`, `user_id`, `username`],
        sort_by: `id`, sort_dir: `asc`, skip: skip, limit: limit
      });
      if (!postsResponse || postsResponse.length === 0) break;
      allPosts.push(...postsResponse);
      if (page < requestsNeeded - 1) await new Promise(r => setTimeout(r, 50));
    }
    if (allPosts.length !== totalPostsInTopic) {
      console.warn(`ep2book: топик ` + topicId + ` — загружено ` + allPosts.length +
                   `, ожидалось ` + totalPostsInTopic);
    }
    return allPosts;
  }

  // ---------- Маски ----------
  function stripMask_ep2book(message) {
    let mask = null;
    let cleaned = String(message || ``);
    cleaned = cleaned.replace(
      /<div\s+class=["']hvmask["'][^>]*>([\s\S]*?)<\/div>/gi,
      function (_, inner) {
        const nickMatch = inner.match(/\[nick\]([\s\S]*?)\[\/nick\]/i);
        if (nickMatch) mask = nickMatch[1].trim();
        return ``;
      }
    );
    if (!mask) {
      const outside = cleaned.match(/\[nick\]([\s\S]*?)\[\/nick\]/i);
      if (outside) {
        mask = outside[1].trim();
        cleaned = cleaned.replace(outside[0], ``);
      }
    }
    return { message: cleaned.trim(), mask: mask };
  }

  function collectAuthors_ep2book() {
    const seen = {}, authors = [];
    state.topicOrder.forEach(tid => {
      (state.posts[tid] || []).forEach(p => {
        const key = p.username + `\u0000` + (p.mask || ``);
        if (seen[key]) return;
        seen[key] = true;
        authors.push({ username: p.username, mask: p.mask || null });
      });
    });
    state.authors = authors;
    return authors;
  }

  async function loadAllPosts_ep2book(onProgress) {
    state.posts = {};
    state.loadedPosts = 0;
    for (let i = 0; i < state.topicOrder.length; i++) {
      const tid = state.topicOrder[i];
      const topic = state.topics[tid];
      if (!topic) continue;
      const expected = 1 + (parseInt(topic.num_replies, 10) || 0);
      const raw = await getAllPostsInTopic_ep2book(tid, expected);
      const processed = raw.map(p => {
        const stripped = stripMask_ep2book(p.message);
        return {
          id: String(p.id),
          username: p.username || ``,
          user_id: String(p.user_id || ``),
          posted: parseInt(p.posted, 10) || 0,
          mask: stripped.mask,
          message: stripped.message
        };
      });
      state.posts[tid] = processed;
      state.loadedPosts += processed.length;
      if (typeof onProgress === `function`) {
        onProgress(i + 1, state.topicOrder.length, state.loadedPosts, state.totalPosts);
      }
    }
    collectAuthors_ep2book();
  }

  // ---------- Обложка ----------
  function extractCoverCandidates_ep2book() {
    const firstTid = state.topicOrder[0];
    if (!firstTid) return [];
    const topic = state.topics[firstTid];
    if (!topic) return [];
    const posts = state.posts[firstTid] || [];
    const first = posts.find(p => p.id === topic.first_post) || posts[0];
    if (!first) return [];
    const urls = [], seen = {};
    const re = /<img[^>]+src=["']([^"']+)["']/gi;
    let m;
    while ((m = re.exec(first.message)) !== null) {
      if (!seen[m[1]]) { seen[m[1]] = true; urls.push(m[1]); }
    }
    return urls;
  }

  // ---------- Валидация постов: движок ----------

  const KNOWN_BB_TAGS_ep2book = [
    `b`, `i`, `u`, `s`, `strike`, `em`, `strong`, `sub`, `sup`,
    `quote`, `code`, `spoiler`, `list`, `*`, `url`, `img`,
    `color`, `size`, `font`, `center`, `left`, `right`, `justify`,
    `hr`, `br`, `table`, `tr`, `td`, `th`, `hide`, `ooc`, `nick`
  ];

  function decodeEntities_ep2book(s) {
    return String(s)
      .replace(/&lt;/g, `<`)
      .replace(/&gt;/g, `>`)
      .replace(/&quot;/g, `"`)
      .replace(/&#0*39;/g, `'`)
      .replace(/&apos;/g, `'`)
      .replace(/&nbsp;/g, ` `)
      .replace(/&#160;/g, ` `)
      .replace(/&amp;/g, `&`);
  }

  function stripIndent_ep2book(html) {
    return String(html).replace(/\[\/?indent\]/gi, ``);
  }

  function extractHtmlBlocks_ep2book(html) {
    const blocks = [];
    const cleaned = String(html).replace(
      /\[html\]([\s\S]*?)\[\/html\]/gi,
      function (raw, content) {
        const marker = `\u0000HTMLBLOCK` + blocks.length + `\u0000`;
        blocks.push({ raw: raw, content: content, marker: marker });
        return marker;
      }
    );
    return { html: cleaned, blocks: blocks };
  }

  function findUnknownBbTags_ep2book(html) {
    const known = {};
    KNOWN_BB_TAGS_ep2book.forEach(t => { known[t.toLowerCase()] = true; });
    known[`*`] = true;

    const found = {};
    const re = /\[(\/?)([a-zA-Z*][a-zA-Z0-9*_]*)(?:=[^\]]*)?\]/g;
    let m;
    while ((m = re.exec(html)) !== null) {
      const closing = m[1] === `/`;
      const tag = m[2].toLowerCase();
      if (known[tag]) continue;
      const key = tag + (closing ? `/close` : `/open`);
      if (found[key]) continue;
      found[key] = { tag: tag, paired: null, raw: m[0] };
    }

    const tagsArr = Object.keys(found).map(k => found[k]);
    tagsArr.forEach(item => {
      const openRe = new RegExp(`\\[` + item.tag + `(?:=[^\\]]*)?\\]`, `i`);
      const closeRe = new RegExp(`\\[\\/` + item.tag + `\\]`, `i`);
      if (openRe.test(html) && closeRe.test(html)) item.paired = true;
      else if (openRe.test(html)) item.paired = false;
    });

    const seen = {};
    const result = [];
    tagsArr.forEach(item => {
      const key = item.tag + (item.paired === true ? `/pair` : `/single`);
      if (seen[key]) return;
      seen[key] = true;
      result.push(item);
    });

    return { tags: result };
  }

  function normalizeParagraphs_ep2book(html) {
    let s = String(html);
    s = s.replace(/<br\s*\/?>/gi, `\u0000BR\u0000`);

    const hasBlockTags = /<(p|div|h[1-6]|ul|ol|li|blockquote|table|tr|td|th)\b/i.test(s);

    if (!hasBlockTags) {
      const parts = s.split(`\u0000BR\u0000`);
      s = parts
        .map(part => part.trim())
        .filter(part => part.length > 0)
        .map(part => `<p>` + part + `</p>`)
        .join(``);
    } else {
      s = s.replace(/<p\b([^>]*)>([\s\S]*?)<\/p>/gi, function (_, attrs, inner) {
        const parts = inner.split(`\u0000BR\u0000`)
          .map(x => x.trim())
          .filter(x => x.length > 0);
        if (!parts.length) return ``;
        return parts.map(x => `<p` + attrs + `>` + x + `</p>`).join(``);
      });

      s = s.replace(/\u0000BR\u0000/g, `</p><p>`);
      s = s.replace(/<p\b[^>]*>\s*<\/p>/gi, ``);
      s = s.replace(/<\/p>\s*<p>/g, `</p><p>`);
    }

    s = s.replace(/^(<\/p>|<p>\s*<\/p>)+/i, ``);
    s = s.replace(/(<p>\s*<\/p>|<\/p>)+$/i, ``);

    return s.trim();
  }

  function validateAllPosts_ep2book() {
    state.questions = [];
    state.questionSeq = 0;

    state.topicOrder.forEach(tid => {
      const posts = state.posts[tid] || [];
      posts.forEach(post => {
        let html = decodeEntities_ep2book(post.message || ``);
        html = stripIndent_ep2book(html);

        const extracted = extractHtmlBlocks_ep2book(html);
        html = extracted.html;
        extracted.blocks.forEach(block => {
          state.questions.push({
            id: ++state.questionSeq,
            tid: tid,
            postId: post.id,
            type: `html`,
            tag: `html`,
            content: block.content,
            raw: block.raw,
            marker: block.marker,
            answer: null
          });
        });

        const unknown = findUnknownBbTags_ep2book(html);
        unknown.tags.forEach(item => {
          state.questions.push({
            id: ++state.questionSeq,
            tid: tid,
            postId: post.id,
            type: `bb`,
            tag: item.tag,
            paired: item.paired === true,
            raw: item.raw,
            answer: null
          });
        });

        html = normalizeParagraphs_ep2book(html);
        post.cleanHtml = html;
      });
    });

    console.log(`ep2book: валидация — вопросов ` + state.questions.length);
    const stats = {};
    state.questions.forEach(q => {
      const k = q.type + `:` + q.tag;
      stats[k] = (stats[k] || 0) + 1;
    });
    console.log(`ep2book: сводка по вопросам`, stats);

    return state.questions;
  }

  // ---------- UI валидации: модалка ----------

  function applyAnswersToCleanHtml_ep2book() {
    state.topicOrder.forEach(tid => {
      const posts = state.posts[tid] || [];
      posts.forEach(post => {
        let html = post.cleanHtml || ``;

        const htmlQs = state.questions.filter(q => q.type === `html` && q.postId === post.id);
        htmlQs.forEach(q => {
          const marker = q.marker;
          if (!marker) return;
          if (q.answer == null) return;
          let replacement = ``;
          if (q.answer.kind === `text`) {
            replacement = q.answer.value || ``;
          } else if (q.answer.kind === `link`) {
            const url = q.answer.value || ``;
            const label = q.answer.label || url;
            replacement = url ? `<p><a href="` + escapeAttr_ep2book(url) + `">` + escapeHtml_ep2book(label) + `</a></p>` : ``;
          } else if (q.answer.kind === `keep`) {
            replacement = escapeHtml_ep2book(q.raw || ``);
          }
          if (html.indexOf(marker) !== -1) {
            html = html.replace(marker, replacement);
          }
        });

        const bbQs = state.questions.filter(q => q.type === `bb` && q.postId === post.id);
        bbQs.forEach(q => {
          if (!q.answer) return;
          const tag = q.tag;
          if (q.answer.kind === `keep`) return;
          if (q.answer.kind === `delete`) {
            if (q.paired) {
              const re = new RegExp(`\\[` + tag + `(?:=[^\\]]*)?\\]([\\s\\S]*?)\\[\\/` + tag + `\\]`, `gi`);
              html = html.replace(re, `$1`);
            } else {
              const re = new RegExp(`\\[` + tag + `(?:=[^\\]]*)?\\]`, `gi`);
              html = html.replace(re, ``);
            }
          } else if (q.answer.kind === `replace`) {
            if (q.paired) {
              const re = new RegExp(`\\[` + tag + `(?:=[^\\]]*)?\\]([\\s\\S]*?)\\[\\/` + tag + `\\]`, `gi`);
              html = html.replace(re, function (_, content) {
                return (q.answer.value || ``).replace(/\{\{content\}\}/g, content);
              });
            } else {
              const re = new RegExp(`\\[` + tag + `(?:=[^\\]]*)?\\]`, `gi`);
              html = html.replace(re, q.answer.value || ``);
            }
          }
        });

        post.cleanHtml = html;
      });
    });
  }

  function findContext_ep2book(q, maxLen) {
    const posts = state.posts[q.tid] || [];
    const post = posts.find(p => p.id === q.postId);
    if (!post) return ``;
    const src = decodeEntities_ep2book(post.message || ``);
    let needle = ``;
    if (q.type === `html`) needle = q.raw || ``;
    else if (q.type === `bb`) needle = `[` + q.tag + `]`;
    if (!needle) return src.slice(0, maxLen || 300);
    const idx = src.indexOf(needle);
    if (idx === -1) return src.slice(0, maxLen || 300);
    const half = Math.floor((maxLen || 300) / 2);
    const from = Math.max(0, idx - half);
    const to = Math.min(src.length, idx + needle.length + half);
    return (from > 0 ? `…` : ``) + src.slice(from, to) + (to < src.length ? `…` : ``);
  }

  function extractFirstUrlFromHtml_ep2book(html) {
    const m = String(html).match(/(?:src|href)\s*=\s*["']([^"']+)["']/i);
    if (m) return m[1];
    const m2 = String(html).match(/https?:\/\/[^\s"'<>]+/i);
    return m2 ? m2[0] : ``;
  }

  function stripHtmlTags_ep2book(html) {
    return String(html)
      .replace(/<script[\s\S]*?<\/script>/gi, ``)
      .replace(/<style[\s\S]*?<\/style>/gi, ``)
      .replace(/<[^>]+>/g, ` `)
      .replace(/\s+/g, ` `)
      .trim();
  }

  function openQuestionModal_ep2book(idx) {
    const $modal = $('#ep2book-app .ep2book-modal');
    const q = state.questions[idx];
    if (!q) return;

    const total = state.questions.length;
    const answered = state.questions.filter(x => x.answer != null).length;

    let html = `<div class="ep2book-modal-box">`;
    html += `<div class="ep2book-modal-progress">Вопрос ` + (idx + 1) + ` из ` + total +
            ` (отвечено: ` + answered + `)</div>`;

    if (q.type === `html`) {
      html += `<h4>[html]-блок в посте ` + escapeHtml_ep2book(q.postId) + `</h4>`;
      html += `<div class="ep2book-modal-context">` + escapeHtml_ep2book(q.content) + `</div>`;
      html += `<p>Медиа-фреймы и скрипты могут ломать читалки. Выберите, на что заменить:</p>`;
      const suggestedUrl = extractFirstUrlFromHtml_ep2book(q.content);
      html += `<div class="ep2book-modal-options">`
           +    `<label><input type="radio" name="ep2book-q-kind" value="text" checked> Заменить текстом</label>`
           +    `<textarea class="ep2book-q-text" placeholder="Текст или базовая разметка (<p>, <em>, <a>)">` + escapeHtml_ep2book(stripHtmlTags_ep2book(q.content)) + `</textarea>`
           +    `<label><input type="radio" name="ep2book-q-kind" value="link"> Заменить ссылкой</label>`
           +    `<input type="text" class="ep2book-q-link" placeholder="https://..." value="` + escapeAttr_ep2book(suggestedUrl) + `">`
           +    `<input type="text" class="ep2book-q-link-label" placeholder="Подпись ссылки (если нужна)" value="` + escapeAttr_ep2book(suggestedUrl) + `">`
           +  `</div>`;
      html += `<label><input type="checkbox" class="ep2book-q-all"> Применить ко всем таким же [html]-блокам</label>`;
    } else if (q.type === `bb`) {
      html += `<h4>Неизвестный тег [` + escapeHtml_ep2book(q.tag) + `]` +
              (q.paired ? ` (парный)` : ` (одиночный)`) + `</h4>`;
      html += `<div class="ep2book-modal-context">` + escapeHtml_ep2book(findContext_ep2book(q, 400)) + `</div>`;
      html += `<p>Что делать с этим тегом?</p>`;
      html += `<div class="ep2book-modal-options">`
           +    `<label><input type="radio" name="ep2book-q-kind" value="keep" checked> Оставить как есть</label>`
           +    `<label><input type="radio" name="ep2book-q-kind" value="delete"> Удалить` + (q.paired ? ` (содержимое оставить)` : ``) + `</label>`
           +    `<label><input type="radio" name="ep2book-q-kind" value="replace"> Своя замена</label>`;
      if (q.paired) {
        html += `<textarea class="ep2book-q-replace" placeholder="Например: <em>{{content}}</em> — {{content}} подставит содержимое между тегами">`
             +  escapeHtml_ep2book(`<span>{{content}}</span>`) + `</textarea>`;
      } else {
        html += `<input type="text" class="ep2book-q-replace" placeholder="На что заменить (пусто = удалить)">`;
      }
      html += `</div>`;
      html += `<label><input type="checkbox" class="ep2book-q-all"> Применить ко всем таким же [` + escapeHtml_ep2book(q.tag) + `]</label>`;
    }

    html += `<div class="ep2book-modal-actions">`
         +    `<button type="button" class="ep2book-q-apply">Применить</button> `
         +    `<button type="button" class="ep2book-q-skip">Пропустить (оставить как есть)</button> `
         +    `<button type="button" class="ep2book-q-cancel">Отменить все ответы и выйти</button>`
         +  `</div>`;
    html += `</div>`;

    $modal.html(html).prop(`hidden`, false);

    $modal.off(`.ep2book-q`);
    $modal.on(`click.ep2book-q`, `.ep2book-q-apply`, function () {
      const kind = $modal.find(`input[name="ep2book-q-kind"]:checked`).val();
      let answer = { kind: kind };

      if (q.type === `html`) {
        if (kind === `text`) {
          answer.value = $modal.find(`.ep2book-q-text`).val();
        } else if (kind === `link`) {
          answer.value = $modal.find(`.ep2book-q-link`).val().trim();
          answer.label = $modal.find(`.ep2book-q-link-label`).val().trim() || answer.value;
        }
      } else if (q.type === `bb`) {
        if (kind === `replace`) {
          answer.value = $modal.find(`.ep2book-q-replace`).val();
        }
      }

      const applyAll = $modal.find(`.ep2book-q-all`).is(`:checked`);
      if (applyAll) {
        state.questions.forEach(other => {
          if (other.type !== q.type) return;
          if (other.tag !== q.tag) return;
          if (!!other.paired !== !!q.paired) return;
          if (other.answer != null) return;
          other.answer = answer;
        });
      } else {
        q.answer = answer;
      }

      $modal.prop(`hidden`, true).empty();
      continueValidationQueue_ep2book();
    });

    $modal.on(`click.ep2book-q`, `.ep2book-q-skip`, function () {
      const answer = { kind: `keep` };
      const applyAll = $modal.find(`.ep2book-q-all`).is(`:checked`);
      if (applyAll) {
        state.questions.forEach(other => {
          if (other.type !== q.type) return;
          if (other.tag !== q.tag) return;
          if (!!other.paired !== !!q.paired) return;
          if (other.answer != null) return;
          other.answer = answer;
        });
      } else {
        q.answer = answer;
      }
      $modal.prop(`hidden`, true).empty();
      continueValidationQueue_ep2book();
    });

    $modal.on(`click.ep2book-q`, `.ep2book-q-cancel`, function () {
      state.questions.forEach(x => { x.answer = null; });
      $modal.prop(`hidden`, true).empty();
      renderStep6_ep2book();
    });

    $modal.on(`change.ep2book-q`, `input[name="ep2book-q-kind"]`, function () {
      const v = $(this).val();
      $modal.find(`.ep2book-q-text, .ep2book-q-link, .ep2book-q-link-label, .ep2book-q-replace`).prop(`disabled`, true);
      if (v === `text`) $modal.find(`.ep2book-q-text`).prop(`disabled`, false);
      if (v === `link`) $modal.find(`.ep2book-q-link, .ep2book-q-link-label`).prop(`disabled`, false);
      if (v === `replace`) $modal.find(`.ep2book-q-replace`).prop(`disabled`, false);
    });
    $modal.find(`input[name="ep2book-q-kind"]:checked`).trigger(`change`);
  }

  function continueValidationQueue_ep2book() {
    const nextIdx = state.questions.findIndex(q => q.answer == null);
    if (nextIdx === -1) {
      applyAnswersToCleanHtml_ep2book();
      renderStep6Final_ep2book();
    } else {
      openQuestionModal_ep2book(nextIdx);
    }
  }

  // ---------- Сборка книги: структура ----------

  function buildAuthorValue_ep2book(post) {
    for (let i = 0; i < state.book.authors.length; i++) {
      const a = state.book.authors[i];
      if (a.username === post.username && (a.mask || null) === (post.mask || null)) {
        return a.value;
      }
    }
    return post.mask || post.username || ``;
  }

  function buildBookStructure_ep2book() {
    const structure = { parts: [] };
    let globalNum = 0;

    state.topicOrder.forEach((tid, partIdx) => {
      const topic = state.topics[tid] || {};
      const posts = state.posts[tid] || [];
      const part = {
        tid: tid,
        subject: topic.subject || ``,
        chapters: []
      };

      if (state.book.partNumbering === `per-part`) globalNum = 0;

      posts.forEach((p, idx) => {
        if (idx === 0) return;
        globalNum++;

        const authorValue = buildAuthorValue_ep2book(p);
        const numForTemplate = (state.book.partNumbering === `per-part`)
          ? idx
          : globalNum;

        const tokens = {
          num: numForTemplate,
          numRom: toRoman_ep2book(numForTemplate),
          author: authorValue,
          AUTHOR: authorValue.toUpperCase()
        };
        const title = applyTemplate_ep2book(state.book.chapterTemplate, tokens);

        part.chapters.push({
          postId: p.id,
          username: p.username,
          mask: p.mask,
          authorValue: authorValue,
          title: title,
          html: p.cleanHtml || ``,
          num: numForTemplate,
          numRom: toRoman_ep2book(numForTemplate)
        });
      });

      structure.parts.push(part);
    });

    return structure;
  }

  // ---------- Computed styles ----------

  function extractComputedStyles_ep2book() {
    const classMap = {};

    const $sandbox = $('<div>').css({
      position: `absolute`,
      left: `-9999px`,
      top: `0`,
      width: `600px`,
      visibility: `hidden`
    }).appendTo(`body`);

    state.topicOrder.forEach(tid => {
      (state.posts[tid] || []).forEach(post => {
        const html = post.cleanHtml || ``;
        // Ищем не только class, но и сам тег — чтобы поймать селекторы вида "em.bbuline".
        const re = /<([a-zA-Z][a-zA-Z0-9]*)\b[^>]*class\s*=\s*["']([^"']+)["'][^>]*>/g;
        let m;
        while ((m = re.exec(html)) !== null) {
          const tagName = m[1].toLowerCase();
          const classes = m[2].split(/\s+/).filter(Boolean);
          classes.forEach(cls => {
            const key = tagName + `.` + cls;
            if (classMap[key]) return;
            const $probe = $(`<` + tagName + `>`).addClass(cls).text(`probe`).appendTo($sandbox);
            const computed = window.getComputedStyle($probe[0]);
            const styles = {};
            const props = [
              `color`, `background-color`, `font-family`, `font-size`, `font-style`,
              `font-weight`, `text-decoration`, `text-decoration-line`, `text-decoration-style`,
              `text-align`, `line-height`,
              `letter-spacing`, `text-transform`, `text-shadow`,
              `margin-top`, `margin-right`, `margin-bottom`, `margin-left`,
              `padding-top`, `padding-right`, `padding-bottom`, `padding-left`,
              `border-top`, `border-right`, `border-bottom`, `border-left`,
              `display`, `width`, `max-width`, `float`, `vertical-align`
            ];
            props.forEach(prop => {
              const val = computed.getPropertyValue(prop);
              if (val && val !== `none` && val !== `normal` && val !== `auto` &&
                  val !== `0px` && val !== `rgba(0, 0, 0, 0)` && val !== `rgb(0, 0, 0)` &&
                  val !== `start` && val !== `visible`) {
                styles[prop] = val;
              }
            });
            classMap[key] = styles;
            $probe.remove();
          });
        }
      });
    });

    $sandbox.remove();
    return classMap;
  }

  function buildCssFromClassMap_ep2book(classMap) {
    let css = ``;
    Object.keys(classMap).forEach(key => {
      const styles = classMap[key];
      const rules = Object.keys(styles).map(p => p + `: ` + styles[p] + `;`).join(` `);
      if (rules) {
        // key имеет вид "em.bbuline" — используем как селектор напрямую.
        css += key + ` { ` + rules + ` }\n`;
      }
    });
    return css;
  }

  // ---------- Сборка EPUB ----------

  function pickJSZip_ep2book(candidate) {
    if (!candidate) return null;
    if (typeof candidate === `function`) return candidate;
    if (typeof candidate.default === `function`) return candidate.default;
    if (typeof candidate.JSZip === `function`) return candidate.JSZip;
    return null;
  }

  function loadJSZip_ep2book() {
    return new Promise((resolve, reject) => {
      const existing = pickJSZip_ep2book(window.JSZip);
      if (existing) { resolve(existing); return; }

      const url = `https://4edo.github.io/mybb/ep2book/jszip.min.js`;
      fetch(url)
        .then(r => {
          if (!r.ok) throw new Error(`Не удалось скачать JSZip: HTTP ` + r.status);
          return r.text();
        })
        .then(code => {
          const runner = new Function(
            `define`, `module`, `exports`, `self`, `global`, `window`,
            `"use strict";\n` + code + `\n;return (typeof JSZip !== "undefined") ? JSZip : null;`
          );
          let jz = null;
          try {
            jz = runner.call(window, undefined, undefined, undefined, window, window, window);
          } catch (e) {
            reject(new Error(`Ошибка выполнения JSZip: ` + (e && e.message ? e.message : e)));
            return;
          }
          const picked = pickJSZip_ep2book(jz) || pickJSZip_ep2book(window.JSZip);
          if (!picked) {
            reject(new Error(`JSZip загрузился, но не инициализировался`));
            return;
          }
          resolve(picked);
        })
        .catch(err => {
          reject(new Error(`Не удалось загрузить JSZip: ` + (err && err.message ? err.message : err)));
        });
    });
  }

  function xmlEscape_ep2book(s) {
    return String(s)
      .replace(/&/g, `&amp;`)
      .replace(/</g, `&lt;`)
      .replace(/>/g, `&gt;`)
      .replace(/"/g, `&quot;`)
      .replace(/'/g, `&apos;`);
  }

  function xhtmlHeader_ep2book(title) {
    return `<?xml version="1.0" encoding="utf-8"?>\n`
         + `<!DOCTYPE html>\n`
         + `<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="ru">\n`
         + `<head>\n`
         + `  <meta charset="utf-8"/>\n`
         + `  <title>` + xmlEscape_ep2book(title) + `</title>\n`
         + `  <link rel="stylesheet" type="text/css" href="style.css"/>\n`
         + `</head>\n`
         + `<body>\n`;
  }

  function xhtmlFooter_ep2book() {
    return `</body>\n</html>\n`;
  }

  // ---------- Санитайзер XHTML ----------

  function sanitizeXhtmlFragment_ep2book(html) {
    if (!html) return ``;

    // Парсим как HTML — DOMParser сам починит незакрытые/лишние теги.
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>` + String(html) + `</div>`, `text/html`);
    const root = doc.body.firstChild;
    if (!root) return ``;

    // Убираем запрещённые в EPUB элементы.
    const FORBIDDEN_TAGS = [`script`, `style`, `iframe`, `object`, `embed`, `form`, `input`, `button`, `meta`, `link`, `base`];
    FORBIDDEN_TAGS.forEach(tag => {
      const els = root.querySelectorAll(tag);
      Array.from(els).forEach(el => el.parentNode && el.parentNode.removeChild(el));
    });

    // Чистим атрибуты: убираем on*, xml:*, xmlns:*.
    const all = root.querySelectorAll(`*`);
    Array.from(all).forEach(el => {
      Array.from(el.attributes).forEach(attr => {
        const name = attr.name.toLowerCase();
        if (name.startsWith(`on`) || name === `xmlns` || name.startsWith(`xmlns:`)) {
          el.removeAttribute(attr.name);
        }
      });
    });

    // Сериализуем обратно в XML.
    const serializer = new XMLSerializer();
    let out = ``;
    Array.from(root.childNodes).forEach(child => {
      out += serializer.serializeToString(child);
    });

    // Убираем xmlns, которые XMLSerializer вешает на каждый тег.
    out = out.replace(/\s+xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/g, ``);

    return out;
  }

  // ---------- Работа с картинками ----------

  function arrayBufferToHex_ep2book(buf) {
    const bytes = new Uint8Array(buf);
    let hex = ``;
    for (let i = 0; i < bytes.length; i++) {
      const b = bytes[i].toString(16);
      hex += b.length === 1 ? `0` + b : b;
    }
    return hex;
  }

  async function sha1BlobHex_ep2book(blob) {
    const ab = await blob.arrayBuffer();
    const digest = await crypto.subtle.digest(`SHA-1`, ab);
    return arrayBufferToHex_ep2book(digest);
  }

  function detectExtFromBlobOrName_ep2book(blob, nameOrUrl) {
    if (blob && blob.type && /^image\//i.test(blob.type)) {
      const sub = blob.type.split(`/`)[1].toLowerCase();
      if (sub === `jpeg`) return `jpg`;
      if (sub === `svg+xml`) return `svg`;
      if (/^[a-z0-9]+$/.test(sub)) return sub;
    }
    const m = String(nameOrUrl || ``).match(/\.(png|jpe?g|gif|webp|svg|bmp|avif)(\?|#|$)/i);
    if (m) {
      const e = m[1].toLowerCase();
      return e === `jpeg` ? `jpg` : e;
    }
    return `bin`;
  }

  async function tryFetchImage_ep2book(url) {
    try {
      const r = await fetch(url, { mode: `cors`, credentials: `omit` });
      if (r.ok) return await r.blob();
    } catch (e) { /* ignore */ }

    try {
      const r = await fetch(url, { mode: `cors`, cache: `no-store` });
      if (r.ok) return await r.blob();
    } catch (e) { /* ignore */ }

    return null;
  }

  function collectAllImageUrls_ep2book() {
    const urls = [];
    const seen = {};

    function push(u) {
      if (!u) return;
      if (/^data:/i.test(u)) return;
      if (/^images\//i.test(u)) return;
      if (/^\.\.?\//.test(u)) return;
      if (seen[u]) return;
      seen[u] = true;
      urls.push(u);
    }

    state.topicOrder.forEach(tid => {
      (state.posts[tid] || []).forEach(post => {
        const re = /<img[^>]+src=["']([^"']+)["']/gi;
        let m;
        while ((m = re.exec(post.cleanHtml || ``)) !== null) {
          push(m[1]);
        }
      });
    });

    if (state.book.cover && state.book.cover.fromForum && state.book.cover.sourceUrl) {
      push(state.book.cover.sourceUrl);
    }

    return urls;
  }

  async function preloadAllImages_ep2book(onProgress, manualResolver) {
    if (!state.book.imageMap) state.book.imageMap = {};

    const urls = collectAllImageUrls_ep2book();
    const failed = [];

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      if (typeof onProgress === `function`) onProgress(i, urls.length, url);

      if (state.book.imageMap[url]) continue;

      let blob = await tryFetchImage_ep2book(url);
      let ext = null;

      if (blob) {
        ext = detectExtFromBlobOrName_ep2book(blob, url);
      } else {
        const manual = await manualResolver(url);
        if (manual && manual.blob) {
          blob = manual.blob;
          ext = manual.ext || detectExtFromBlobOrName_ep2book(blob, manual.name || url);
        }
      }

      if (blob && ext) {
        const hex = await sha1BlobHex_ep2book(blob);
        const path = `images/` + hex + `.` + ext;
        state.book.imageMap[url] = { blob: blob, ext: ext, path: path };
      } else {
        failed.push(url);
      }
    }

    if (typeof onProgress === `function`) onProgress(urls.length, urls.length, ``);
    state.book.failedImages = failed;
    return { map: state.book.imageMap, failed: failed };
  }

  function rewriteImageSrcs_ep2book(html) {
    const map = state.book.imageMap || {};
    return String(html).replace(
      /(<img[^>]+src=["'])([^"']+)(["'])/gi,
      function (full, pre, url, post) {
        if (map[url] && map[url].path) {
          return pre + map[url].path + post;
        }
        return full;
      }
    );
  }

  function askManualImage_ep2book(url, idx, total) {
    return new Promise(resolve => {
      const $modal = $('#ep2book-app .ep2book-modal');

      let html = `<div class="ep2book-modal-box">`;
      html += `<div class="ep2book-modal-progress">Картинка ` + (idx + 1) + ` из ` + total + `</div>`;
      html += `<h4>Не удалось скачать картинку</h4>`;
      html += `<p><a href="` + escapeAttr_ep2book(url) + `" target="_blank" rel="noopener">` + escapeHtml_ep2book(url) + `</a></p>`;
      html += `<p class="ep2book-muted">Ссылки могут устаревать. Если оставить её в книге, со временем изображение может пропасть. ` +
              `Вы можете скачать картинку вручную и загрузить файл.</p>`;
      html += `<div class="ep2book-modal-options">`;
      html += `  <input type="file" class="ep2book-image-file" accept="image/*">`;
      html += `</div>`;
      html += `<div class="ep2book-modal-actions">`;
      html += `  <button type="button" class="ep2book-image-upload" disabled>Загрузить файл</button> `;
      html += `  <button type="button" class="ep2book-image-skip">Оставить ссылкой</button> `;
      html += `  <button type="button" class="ep2book-image-skip-all">Оставить все такие же ссылкой</button>`;
      html += `</div>`;
      html += `</div>`;

      $modal.html(html).prop(`hidden`, false);

      let chosen = null;

      $modal.off(`.ep2book-image`);
      $modal.on(`change.ep2book-image`, `.ep2book-image-file`, function () {
        chosen = this.files && this.files[0] ? this.files[0] : null;
        $modal.find(`.ep2book-image-upload`).prop(`disabled`, !chosen);
      });

      $modal.on(`click.ep2book-image`, `.ep2book-image-upload`, function () {
        if (!chosen) return;
        const ext = detectExtFromBlobOrName_ep2book(chosen, chosen.name);
        $modal.prop(`hidden`, true).empty();
        resolve({ blob: chosen, ext: ext, name: chosen.name });
      });

      $modal.on(`click.ep2book-image`, `.ep2book-image-skip`, function () {
        $modal.prop(`hidden`, true).empty();
        resolve(null);
      });

      $modal.on(`click.ep2book-image`, `.ep2book-image-skip-all`, function () {
        state.book.skipAllManualImages = true;
        $modal.prop(`hidden`, true).empty();
        resolve(null);
      });
    });
  }

  async function manualImageResolver_ep2book(url, idx, total) {
    if (state.book.skipAllManualImages) return null;
    return await askManualImage_ep2book(url, idx, total);
  }

  // ---------- XHTML/OPF-сборщики ----------

  function dataUrlToBlob_ep2book(dataUrl) {
    const parts = String(dataUrl).split(`,`);
    const mime = parts[0].match(/data:([^;]+);/);
    const mimeType = mime ? mime[1] : `application/octet-stream`;
    const bin = atob(parts[1]);
    const len = bin.length;
    const arr = new Uint8Array(len);
    for (let i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mimeType });
  }

  function buildCoverXhtml_ep2book(imagePath) {
    let html = xhtmlHeader_ep2book(`Обложка`);
    html += `<section epub:type="cover" class="ep2book-cover-page">\n`;
    html += `<img src="` + xmlEscape_ep2book(imagePath) + `" alt="Обложка"/>\n`;
    html += `</section>\n`;
    html += xhtmlFooter_ep2book();
    return html;
  }

  function buildTitleXhtml_ep2book(bodyHtml) {
    let html = xhtmlHeader_ep2book(state.book.title || `Титул`);
    html += `<section epub:type="titlepage">\n`;
    html += `<h1>` + xmlEscape_ep2book(state.book.title || ``) + `</h1>\n`;
    if (bodyHtml) {
      html += sanitizeXhtmlFragment_ep2book(bodyHtml) + `\n`;
    }
    html += `</section>\n`;
    html += xhtmlFooter_ep2book();
    return html;
  }

  function buildPartTitle_ep2book(part, partIdx) {
    const tokens = {
      num: partIdx + 1,
      numRom: toRoman_ep2book(partIdx + 1),
      subject: part.subject || ``,
      SUBJECT: (part.subject || ``).toUpperCase()
    };
    return applyTemplate_ep2book(state.book.partTemplate, tokens);
  }

  function buildPartXhtml_ep2book(part, partIdx) {
    const title = buildPartTitle_ep2book(part, partIdx);
    let html = xhtmlHeader_ep2book(title);
    html += `<section epub:type="part">\n`;
    html += `<h1>` + xmlEscape_ep2book(title) + `</h1>\n`;
    const firstPost = (state.posts[part.tid] || [])[0];
    if (firstPost && firstPost.cleanHtml) {
      html += sanitizeXhtmlFragment_ep2book(rewriteImageSrcs_ep2book(firstPost.cleanHtml)) + `\n`;
    }
    html += `</section>\n`;
    html += xhtmlFooter_ep2book();
    return html;
  }

  function buildChapterXhtml_ep2book(chapter) {
    const bodyHtml = rewriteImageSrcs_ep2book(chapter.html);
    let html = xhtmlHeader_ep2book(chapter.title);
    html += `<section epub:type="chapter">\n`;
    html += `<h2>` + xmlEscape_ep2book(chapter.title) + `</h2>\n`;
    html += sanitizeXhtmlFragment_ep2book(bodyHtml) + `\n`;
    html += `</section>\n`;
    html += xhtmlFooter_ep2book();
    return html;
  }

  function buildNavXhtml_ep2book(navItems, structure, coverHref) {
    let html = `<?xml version="1.0" encoding="utf-8"?>\n`
             + `<!DOCTYPE html>\n`
             + `<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="ru">\n`
             + `<head>\n`
             + `  <meta charset="utf-8"/>\n`
             + `  <title>Оглавление</title>\n`
             + `</head>\n`
             + `<body>\n`
             + `<nav epub:type="toc" id="toc">\n`
             + `<h1>Оглавление</h1>\n`
             + `<ol>\n`;
    if (coverHref) {
      html += `<li><a href="` + xmlEscape_ep2book(coverHref) + `">Обложка</a></li>\n`;
    }
    navItems.forEach(item => {
      html += `<li><a href="` + xmlEscape_ep2book(item.href) + `">` + xmlEscape_ep2book(item.title || ``) + `</a>`;
      if (item.children && item.children.length) {
        html += `<ol>`;
        item.children.forEach(ch => {
          html += `<li><a href="` + xmlEscape_ep2book(ch.href) + `">` + xmlEscape_ep2book(ch.title || ``) + `</a></li>`;
        });
        html += `</ol>`;
      }
      html += `</li>\n`;
    });
    html += `</ol>\n</nav>\n`;

    html += `<nav epub:type="landmarks" hidden="hidden">\n<h2>Landmarks</h2>\n<ol>\n`;
    if (coverHref) {
      html += `<li><a epub:type="cover" href="` + xmlEscape_ep2book(coverHref) + `">Обложка</a></li>\n`;
    }
    html += `<li><a epub:type="toc" href="nav.xhtml">Оглавление</a></li>\n`;
    html += `<li><a epub:type="titlepage" href="title.xhtml">Титул</a></li>\n`;
    html += `<li><a epub:type="bodymatter" href="` + xmlEscape_ep2book(navItems.length ? navItems[0].href : `title.xhtml`) + `">Начало</a></li>\n`;
    html += `</ol>\n</nav>\n`;

    html += `</body>\n</html>\n`;
    return html;
  }

  function buildTocNcx_ep2book(navItems, structure) {
    const uid = `ep2book-` + Date.now();
    let html = `<?xml version="1.0" encoding="utf-8"?>\n`
             + `<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">\n`
             + `  <head>\n`
             + `    <meta name="dtb:uid" content="` + xmlEscape_ep2book(uid) + `"/>\n`
             + `    <meta name="dtb:depth" content="2"/>\n`
             + `    <meta name="dtb:totalPageCount" content="0"/>\n`
             + `    <meta name="dtb:maxPageNumber" content="0"/>\n`
             + `  </head>\n`
             + `  <docTitle><text>` + xmlEscape_ep2book(state.book.title || ``) + `</text></docTitle>\n`
             + `  <navMap>\n`;

    let playOrder = 1;
    function ncxPoint(item) {
      let s = `    <navPoint id="navPoint-` + playOrder + `" playOrder="` + playOrder + `">\n`;
      s += `      <navLabel><text>` + xmlEscape_ep2book(item.title || ``) + `</text></navLabel>\n`;
      s += `      <content src="` + xmlEscape_ep2book(item.href) + `"/>\n`;
      playOrder++;
      if (item.children && item.children.length) {
        item.children.forEach(ch => { s += ncxPoint(ch); });
      }
      s += `    </navPoint>\n`;
      return s;
    }
    navItems.forEach(item => { html += ncxPoint(item); });

    html += `  </navMap>\n</ncx>\n`;
    return html;
  }

  function buildOpf_ep2book(files, coverHtmlHref, coverImagePath, structure) {
    const uid = `ep2book-` + Date.now();
    let manifest = `    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>\n`
                 + `    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>\n`
                 + `    <item id="css" href="style.css" media-type="text/css"/>\n`;

    if (coverHtmlHref) {
      manifest += `    <item id="cover" href="` + xmlEscape_ep2book(coverHtmlHref) + `" media-type="application/xhtml+xml"/>\n`;
    }

    files.forEach(f => {
      manifest += `    <item id="` + xmlEscape_ep2book(f.id) + `" href="` + xmlEscape_ep2book(f.href) + `" media-type="` + f.mediaType + `"/>\n`;
    });

    const imageMap = state.book.imageMap || {};
    const imageIds = {};
    Object.keys(imageMap).forEach(url => {
      const entry = imageMap[url];
      const id = `img-` + entry.path.replace(/[^a-z0-9]/gi, `-`);
      if (imageIds[id]) return;
      imageIds[id] = true;
      const ext = entry.ext === `jpg` ? `jpeg` : entry.ext;
      manifest += `    <item id="` + xmlEscape_ep2book(id) + `" href="` + xmlEscape_ep2book(entry.path) + `" media-type="image/` + ext + `"/>\n`;
    });

    if (coverImagePath && !/^https?:/i.test(coverImagePath)) {
      const already = manifest.indexOf(`href="` + coverImagePath + `"`) !== -1;
      if (!already) {
        const ext = (coverImagePath.match(/\.([a-z0-9]+)$/i) || [])[1] || `jpeg`;
        const mediaExt = ext === `jpg` ? `jpeg` : ext;
        manifest += `    <item id="cover-image" href="` + xmlEscape_ep2book(coverImagePath) + `" media-type="image/` + mediaExt + `" properties="cover-image"/>\n`;
      }
    }

    let spine = ``;
    if (coverHtmlHref) spine += `    <itemref idref="cover"/>\n`;
    files.forEach(f => {
      spine += `    <itemref idref="` + xmlEscape_ep2book(f.id) + `"/>\n`;
    });

    const authorsXml = state.book.authors.map(a => {
      const value = a.value || a.username || ``;
      const parts = String(value).split(/\s+/);
      const last = parts.length > 1 ? parts[parts.length - 1] : ``;
      const first = parts.length > 1 ? parts.slice(0, -1).join(` `) : value;
      return `    <dc:creator opf:role="aut" opf:file-as="` + xmlEscape_ep2book(last ? (last + `, ` + first) : value) + `">` + xmlEscape_ep2book(value) + `</dc:creator>\n`;
    }).join(``);

    return `<?xml version="1.0" encoding="utf-8"?>\n`
         + `<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="ru">\n`
         + `  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">\n`
         + `    <dc:identifier id="bookid">` + xmlEscape_ep2book(uid) + `</dc:identifier>\n`
         + `    <dc:title>` + xmlEscape_ep2book(state.book.title || ``) + `</dc:title>\n`
         + `    <dc:language>ru</dc:language>\n`
         + authorsXml
         + (state.book.series ? `    <meta property="belongs-to-collection" id="series">` + xmlEscape_ep2book(state.book.series) + `</meta>\n` : ``)
         + `    <meta property="dcterms:modified">` + new Date().toISOString().replace(/\.\d+Z$/, `Z`) + `</meta>\n`
         + `  </metadata>\n`
         + `  <manifest>\n` + manifest + `  </manifest>\n`
         + `  <spine toc="ncx">\n` + spine + `  </spine>\n`
         + `</package>\n`;
  }

  async function buildEpubBlob_ep2book(onStatus) {
    const JSZip = await loadJSZip_ep2book();

    const structure = buildBookStructure_ep2book();
    const classMap = extractComputedStyles_ep2book();
    const css = buildCssFromClassMap_ep2book(classMap);

    let manualIdx = 0;
    const totalUrls = collectAllImageUrls_ep2book().length;
    await preloadAllImages_ep2book(
      function (done, total, url) {
        if (typeof onStatus === `function`) {
          onStatus(`Картинки: ` + done + ` / ` + total);
        }
      },
      async function (url) {
        manualIdx++;
        return await manualImageResolver_ep2book(url, manualIdx - 1, totalUrls);
      }
    );

    const zip = new JSZip();

    zip.file(`mimetype`, `application/epub+zip`, { compression: `STORE` });

    zip.file(`META-INF/container.xml`,
      `<?xml version="1.0" encoding="UTF-8"?>\n`
    + `<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">\n`
    + `  <rootfiles>\n`
    + `    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>\n`
    + `  </rootfiles>\n`
    + `</container>\n`);

    zip.file(`OEBPS/style.css`,
      `body { font-family: serif; line-height: 1.5; }\n`
    + `h1, h2, h3 { font-weight: bold; }\n`
    + `p { margin: 0 0 0.6em 0; text-indent: 1.2em; }\n`
    + `p:first-of-type { text-indent: 0; }\n`
    + `img { max-width: 100%; height: auto; }\n`
    + `.ep2book-cover-page { text-align: center; margin: 0; padding: 0; }\n`
    + `.ep2book-cover-page img { max-width: 100%; max-height: 100%; }\n`
    + `nav ol { list-style: none; padding-left: 0; }\n`
    + `nav ol ol { padding-left: 1.2em; }\n`
    + `.bbuline, em.bbuline, strong.bbuline { text-decoration: underline; }\n`
    + css);

    const imageMap = state.book.imageMap || {};
    Object.keys(imageMap).forEach(url => {
      const entry = imageMap[url];
      zip.file(`OEBPS/` + entry.path, entry.blob);
    });

    let coverHtmlHref = null;
    let coverImagePath = null;

    if (state.book.cover) {
      if (state.book.cover.fromForum && state.book.cover.sourceUrl) {
        const entry = imageMap[state.book.cover.sourceUrl];
        if (entry) coverImagePath = entry.path;
        else coverImagePath = state.book.cover.sourceUrl;
      } else if (state.book.cover.blob) {
        const ext = detectExtFromBlobOrName_ep2book(state.book.cover.blob, state.book.cover.name || ``);
        const hex = await sha1BlobHex_ep2book(state.book.cover.blob);
        const path = `images/cover-` + hex + `.` + ext;
        zip.file(`OEBPS/` + path, state.book.cover.blob);
        coverImagePath = path;
      } else if (state.book.cover.dataUrl) {
        const blob = dataUrlToBlob_ep2book(state.book.cover.dataUrl);
        const ext = detectExtFromBlobOrName_ep2book(blob, state.book.cover.name || ``);
        const hex = await sha1BlobHex_ep2book(blob);
        const path = `images/cover-` + hex + `.` + ext;
        zip.file(`OEBPS/` + path, blob);
        coverImagePath = path;
      }

      if (coverImagePath) {
        zip.file(`OEBPS/cover.xhtml`, buildCoverXhtml_ep2book(coverImagePath));
        coverHtmlHref = `cover.xhtml`;
      }
    }

    const files = [];
    const navItems = [];

    const titleHref = `title.xhtml`;
    const firstTid = state.topicOrder[0];
    const firstPost = (state.posts[firstTid] || [])[0];
    const titleBodyHtml = firstPost
      ? rewriteImageSrcs_ep2book(firstPost.cleanHtml || ``)
      : ``;
    zip.file(`OEBPS/` + titleHref, buildTitleXhtml_ep2book(titleBodyHtml));
    files.push({
      id: `title`,
      href: titleHref,
      mediaType: `application/xhtml+xml`,
      title: state.book.title || `Титул`,
      inSpine: true
    });
    navItems.push({ href: titleHref, title: state.book.title || `Титул` });

    structure.parts.forEach((part, partIdx) => {
      let partNav = null;
      if (state.mode === `multi`) {
        const partTitle = buildPartTitle_ep2book(part, partIdx);
        const partHtml = buildPartXhtml_ep2book(part, partIdx);
        const partHref = `part` + (partIdx + 1) + `.xhtml`;
        zip.file(`OEBPS/` + partHref, partHtml);
        files.push({
          id: `part` + (partIdx + 1),
          href: partHref,
          mediaType: `application/xhtml+xml`,
          title: partTitle,
          inSpine: true
        });
        partNav = { href: partHref, title: partTitle, children: [] };
        navItems.push(partNav);
      }

      part.chapters.forEach(chapter => {
        const href = `chapter-` + partIdx + `-` + chapter.postId + `.xhtml`;
        const chHtml = buildChapterXhtml_ep2book(chapter);
        zip.file(`OEBPS/` + href, chHtml);
        files.push({
          id: `ch-` + partIdx + `-` + chapter.postId,
          href: href,
          mediaType: `application/xhtml+xml`,
          title: chapter.title,
          inSpine: true
        });
        const navItem = { href: href, title: chapter.title };
        if (partNav) partNav.children.push(navItem);
        else navItems.push(navItem);
      });
    });

    zip.file(`OEBPS/nav.xhtml`, buildNavXhtml_ep2book(navItems, structure, coverHtmlHref));

    const ncxItems = coverHtmlHref
      ? [{ href: coverHtmlHref, title: `Обложка` }].concat(navItems)
      : navItems;
    zip.file(`OEBPS/toc.ncx`, buildTocNcx_ep2book(ncxItems, structure));

    zip.file(`OEBPS/content.opf`, buildOpf_ep2book(files, coverHtmlHref, coverImagePath, structure));

    if (typeof onStatus === `function`) onStatus(`Упаковка...`);

    return await zip.generateAsync({
      type: `blob`,
      mimeType: `application/epub+zip`,
      compression: `DEFLATE`
    });
  }

  // ---------- Шаг 1 ----------
  function bindStep1($root) {
    const $app = $root;

    function setMode(mode) {
      const prev = state.mode;
      if (prev === mode) return;
      const $single = $app.find(`.ep2book-links-single`);
      const $multi = $app.find(`.ep2book-links-multi`);
      if (prev === `single` && mode === `multi`) {
        const val = $single.val().trim();
        if (val) $multi.val(val + `\n`);
      } else if (prev === `multi` && mode === `single`) {
        const lines = normalizeLinks($multi.val());
        $single.val(lines.length ? lines[0] : ``);
      }
      state.mode = mode;
      const multi = mode === `multi`;
      $app.find(`input[name="ep2book-mode"][value="` + mode + `"]`).prop(`checked`, true);
      $app.find(`.ep2book-input-single`).prop(`hidden`, multi);
      $app.find(`.ep2book-input-multi`).prop(`hidden`, !multi);
      $app.find(`.ep2book-check`).text(multi ? `Проверить эпизоды` : `Проверить эпизод`);
    }

    $app.on(`change`, `input[name="ep2book-mode"]`, function () { setMode($(this).val()); });

    $app.on(`click`, `.ep2book-check`, async function () {
      const $status = $app.find(`.ep2book-step1-status`);
      const $btn = $(this);
      let raw = state.mode === `single`
        ? $app.find(`.ep2book-links-single`).val()
        : $app.find(`.ep2book-links-multi`).val();
      const links = normalizeLinks(raw);
      if (links.length === 0) { setStatus($status, `Укажите хотя бы одну ссылку.`, `err`); return; }
      const { tids, bad, dupes } = extractTids_ep2book(links);
      if (bad.length) { setStatus($status, `Не удалось разобрать ссылки в строках: ` + bad.join(`, `), `err`); return; }
      if (dupes.length) {
        const desc = dupes.map(d => `id ` + d.tid + ` (строки ` + d.lines.join(`, `) + `)`).join(`; `);
        setStatus($status, `Дублирующиеся ссылки: ` + desc + `. Уберите повторы.`, `err`); return;
      }
      state.links = links;
      state.tids = tids;
      $btn.prop(`disabled`, true);
      setStatus($status, `Загрузка эпизодов...`, `ok`);
      try {
        const ordered = await loadTopics_ep2book(tids);
        if (!ordered.length) { setStatus($status, `Не удалось получить ни одного эпизода.`, `err`); return; }
        setStatus($status, `Эпизодов: ` + ordered.length + `.`, `ok`);
        renderStep2_ep2book();
        showStep(2);
      } catch (err) {
        console.error(`ep2book: ошибка загрузки топиков`, err);
        setStatus($status, `Ошибка загрузки: ` + (err && err.message ? err.message : err), `err`);
      } finally {
        $btn.prop(`disabled`, false);
      }
    });
  }

  // ---------- Шаг 2 ----------
  function renderStep2_ep2book() {
    const $step = $('#ep2book-app .ep2book-step[data-step="2"]');
    $step.off(`.ep2book-step2`);

    function redraw() {
      let html = `<h3>Проверьте порядок эпизодов</h3><ol class="ep2book-episodes">`;
      state.tids.forEach((tid, idx) => {
        const t = state.topics[tid] || {};
        const subject = t.subject ? escapeHtml_ep2book(t.subject) : `(без названия)`;
        const count = t.num_replies != null ? 1 + t.num_replies : `?`;
        html += `<li data-tid="` + escapeHtml_ep2book(tid) + `">`
             +  `<span class="ep2book-ep-subject">` + subject + `</span>`
             +  ` <span class="ep2book-muted">(id ` + escapeHtml_ep2book(tid) + `, постов: ` + count + `)</span>`
             +  ` <span class="ep2book-ep-actions">`
             +    `<button type="button" class="ep2book-ep-up" ` + (idx === 0 ? `disabled` : ``) + `>↑</button>`
             +    `<button type="button" class="ep2book-ep-down" ` + (idx === state.tids.length - 1 ? `disabled` : ``) + `>↓</button>`
             +    `<button type="button" class="ep2book-ep-remove">Удалить</button>`
             +  `</span>`
             +  `</li>`;
      });
      html += `</ol>`;
      html += `<p>Обнаружено постов: <strong>` + state.totalPosts + `</strong></p>`;
      html += `<div class="ep2book-add-episode-block">`
           +  `<input type="text" class="ep2book-add-episode-url" placeholder="` + escapeHtml_ep2book(window.location.origin + `/viewtopic.php?id=...`) + `">`
           +  `<button type="button" class="ep2book-add-episode">Добавить эпизод</button>`
           +  `</div><div class="ep2book-step2-status"></div>`;
      html += `<p><button type="button" class="ep2book-load-posts">Порядок верный, загрузить посты</button></p>`;
      $step.html(html).prop(`hidden`, false);
    }

    $step.on(`click.ep2book-step2`, `.ep2book-ep-up`, function () {
      const tid = $(this).closest(`li`).data(`tid`).toString();
      const i = state.tids.indexOf(tid);
      if (i > 0) {
        const tmp = state.tids[i - 1]; state.tids[i - 1] = state.tids[i]; state.tids[i] = tmp;
        state.topicOrder = state.tids.slice(); redraw();
      }
    });

    $step.on(`click.ep2book-step2`, `.ep2book-ep-down`, function () {
      const tid = $(this).closest(`li`).data(`tid`).toString();
      const i = state.tids.indexOf(tid);
      if (i >= 0 && i < state.tids.length - 1) {
        const tmp = state.tids[i + 1]; state.tids[i + 1] = state.tids[i]; state.tids[i] = tmp;
        state.topicOrder = state.tids.slice(); redraw();
      }
    });

    $step.on(`click.ep2book-step2`, `.ep2book-ep-remove`, function () {
      const tid = $(this).closest(`li`).data(`tid`).toString();
      state.tids = state.tids.filter(x => x !== tid);
      delete state.topics[tid];
      state.topicOrder = state.tids.slice();
      recalcTotalPosts_ep2book();
      redraw();
    });

    $step.on(`click.ep2book-step2`, `.ep2book-add-episode`, async function () {
      const $status = $step.find(`.ep2book-step2-status`);
      const url = $step.find(`.ep2book-add-episode-url`).val().trim();
      const tid = parseTid(url);
      if (!tid) { setStatus($status, `Не удалось разобрать ссылку.`, `err`); return; }
      if (state.tids.indexOf(tid) !== -1) { setStatus($status, `Этот эпизод уже добавлен.`, `err`); return; }
      setStatus($status, `Загрузка эпизода...`, `ok`);
      try {
        const ordered = await fetchTopics_ep2book([tid]);
        if (!ordered.length) { setStatus($status, `Эпизод не найден.`, `err`); return; }
        const t = ordered[0];
        state.topics[t.id] = t;
        state.tids.push(t.id);
        state.topicOrder = state.tids.slice();
        recalcTotalPosts_ep2book();
        setStatus($status, ``, ``);
        redraw();
      } catch (err) {
        console.error(`ep2book: ошибка добавления эпизода`, err);
        setStatus($status, `Ошибка загрузки: ` + (err && err.message ? err.message : err), `err`);
      }
    });

    $step.on(`keydown.ep2book-step2`, `.ep2book-add-episode-url`, function (e) {
      if (e.key === `Enter`) { e.preventDefault(); $step.find(`.ep2book-add-episode`).trigger(`click`); }
    });

    $step.on(`click.ep2book-step2`, `.ep2book-load-posts`, async function () {
      const $btn = $(this);
      $btn.prop(`disabled`, true);
      renderStep3_ep2book();
      showStep(3);
      try {
        await loadAllPosts_ep2book(function (done, total, loaded, expected) {
          const $status = $('#ep2book-app .ep2book-step[data-step="3"] .ep2book-step3-status');
          setStatus($status, `Загружено эпизодов: ` + done + ` / ` + total +
                             `. Постов: ` + loaded + ` / ` + expected + `...`, `ok`);
        });
        renderStep3_ep2book();
      } catch (err) {
        console.error(`ep2book: ошибка загрузки постов`, err);
        const $status = $('#ep2book-app .ep2book-step[data-step="3"] .ep2book-step3-status');
        setStatus($status, `Ошибка загрузки постов: ` + (err && err.message ? err.message : err), `err`);
      } finally {
        $btn.prop(`disabled`, false);
      }
    });

    redraw();
  }

  // ---------- Шаг 3 ----------
  function renderStep3_ep2book() {
    const $step = $('#ep2book-app .ep2book-step[data-step="3"]');
    $step.off(`.ep2book-step3`);

    let html = `<h3>Посты загружены</h3>`;
    html += `<p>Обнаружено постов: <strong>` + state.totalPosts + `</strong>. `;
    html += `Фактически загружено: <strong>` + state.loadedPosts + `</strong>.</p>`;
    if (state.loadedPosts !== state.totalPosts) {
      html += `<p class="ep2book-err">Количество постов не совпадает. ` +
              `Возможно, часть постов была удалена, либо API отдал не всё.</p>`;
    }
    html += `<p>Авторы (` + state.authors.length + `):</p><ul class="ep2book-authors">`;
    state.authors.forEach(a => {
      const label = a.mask
        ? escapeHtml_ep2book(a.username) + ` (aka ` + escapeHtml_ep2book(a.mask) + `)`
        : escapeHtml_ep2book(a.username);
      html += `<li>` + label + `</li>`;
    });
    html += `</ul><div class="ep2book-step3-status"></div>`;
    html += `<p><button type="button" class="ep2book-go-step4">Дальше: параметры книги</button></p>`;
    $step.html(html).prop(`hidden`, false);

    $step.on(`click.ep2book-step3`, `.ep2book-go-step4`, function () {
      initBookParams_ep2book();
      renderStep4_ep2book();
      showStep(4);
    });
  }

  // ---------- Параметры книги ----------
  function initBookParams_ep2book() {
    const firstTid = state.topicOrder[0];
    const firstTopic = state.topics[firstTid] || {};
    state.book.series = window.location.host;
    state.book.title = firstTopic.subject || ``;
    state.book.authors = state.authors.map(a => ({
      username: a.username, mask: a.mask, value: a.mask || a.username
    }));
    state.book.coversFound = extractCoverCandidates_ep2book();
    state.book.cover = null;
  }

  // ---------- Шаг 4 ----------
  function renderStep4_ep2book() {
    const $step = $('#ep2book-app .ep2book-step[data-step="4"]');
    $step.off(`.ep2book-step4`);

    function renderCoverCandidates_ep2book() {
      if (!state.book.coversFound.length) {
        return `<span class="ep2book-muted">Картинок в заглавном посте не найдено</span>`;
      }
      let html = `<div class="ep2book-cover-list">`;
      state.book.coversFound.forEach(url => {
        const checked = (state.book.cover && state.book.cover.sourceUrl === url) ? ` checked` : ``;
        html += `<label class="ep2book-cover-item">`
             +    `<input type="radio" name="ep2book-cover-src" value="` + escapeHtml_ep2book(url) + `"` + checked + `>`
             +    `<img src="` + escapeHtml_ep2book(url) + `" alt="">`
             +  `</label>`;
      });
      html += `</div>`;
      return html;
    }

    function renderCoverChosen_ep2book() {
      let html = `<div class="ep2book-cover-preview">`;
      if (state.book.cover) {
        html += `<img src="` + escapeHtml_ep2book(state.book.cover.dataUrl) + `" alt="">`;
        html += `<div><button type="button" class="ep2book-cover-remove">Удалить</button></div>`;
      } else {
        html += `<span class="ep2book-muted">Обложка не выбрана</span>`;
      }
      html += `</div><div><input type="file" class="ep2book-cover-file" accept="image/*"></div>`;
      return html;
    }

    function redraw() {
      let html = `<h3>Параметры книги</h3>`;
      html += `<table class="ep2book-params">`;
      html += `<thead><tr><th>Пункт</th><th>Прочитано</th><th>В книге</th></tr></thead><tbody>`;
      html += `<tr><td class="ep2book-col-label">Серия</td>`
           +  `<td class="ep2book-col-read">` + escapeHtml_ep2book(window.location.host) + `</td>`
           +  `<td class="ep2book-col-edit"><input type="text" class="ep2book-book-series" value="` + escapeHtml_ep2book(state.book.series) + `"></td></tr>`;
      html += `<tr><td class="ep2book-col-label">Название</td>`
           +  `<td class="ep2book-col-read">` + escapeHtml_ep2book(state.book.title) + `</td>`
           +  `<td class="ep2book-col-edit"><input type="text" class="ep2book-book-title" value="` + escapeHtml_ep2book(state.book.title) + `"></td></tr>`;
      state.book.authors.forEach((a, i) => {
        html += `<tr><td class="ep2book-col-label">Автор ` + (i + 1) + `</td>`
             +  `<td class="ep2book-col-read"><div class="ep2book-author-pair">`
             +    `<input type="text" readonly value="` + escapeHtml_ep2book(a.username) + `">`
             +    `<input type="text" readonly value="` + (a.mask ? escapeHtml_ep2book(a.mask) : ``) + `" placeholder="маска отсутствует">`
             +  `</div></td>`
             +  `<td class="ep2book-col-edit"><input type="text" class="ep2book-book-author" data-idx="` + i + `" value="` + escapeHtml_ep2book(a.value) + `"></td></tr>`;
      });
      html += `<tr><td class="ep2book-col-label">Обложка</td>`
           +  `<td class="ep2book-col-read">` + renderCoverCandidates_ep2book() + `</td>`
           +  `<td class="ep2book-col-edit">` + renderCoverChosen_ep2book() + `</td></tr>`;
      html += `</tbody></table>`;
      html += `<div class="ep2book-step4-status"></div>`;
      html += `<p><button type="button" class="ep2book-go-step5">Дальше: заголовки</button></p>`;
      $step.html(html).prop(`hidden`, false);
    }

    $step.on(`input.ep2book-step4`, `.ep2book-book-series`, function () { state.book.series = $(this).val(); });
    $step.on(`input.ep2book-step4`, `.ep2book-book-title`, function () { state.book.title = $(this).val(); });
    $step.on(`input.ep2book-step4`, `.ep2book-book-author`, function () {
      const i = parseInt($(this).data(`idx`), 10);
      if (state.book.authors[i]) state.book.authors[i].value = $(this).val();
    });

    $step.on(`change.ep2book-step4`, `input[name="ep2book-cover-src"]`, function () {
      const url = $(this).val();
      state.book.cover = { sourceUrl: url, dataUrl: url, name: null, blob: null, fromForum: true };
      redraw();
    });

    $step.on(`click.ep2book-step4`, `.ep2book-cover-remove`, function () {
      state.book.cover = null;
      redraw();
    });

    $step.on(`change.ep2book-step4`, `.ep2book-cover-file`, function () {
      const file = this.files && this.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function (e) {
        state.book.cover = {
          sourceUrl: null, dataUrl: e.target.result, name: file.name, blob: file, fromForum: false
        };
        redraw();
      };
      reader.readAsDataURL(file);
    });

    $step.on(`click.ep2book-step4`, `.ep2book-go-step5`, function () {
      renderStep5_ep2book();
      showStep(5);
    });

    redraw();
  }

  // ---------- Шаг 5: заголовки ----------
  function renderStep5_ep2book() {
    const $step = $('#ep2book-app .ep2book-step[data-step="5"]');
    $step.off(`.ep2book-step5`);

    function previewChapter() {
      const sampleAuthor = state.book.authors[0] ? state.book.authors[0].value : `Автор`;
      const tokens = { num: 1, numRom: toRoman_ep2book(1), author: sampleAuthor, AUTHOR: sampleAuthor.toUpperCase() };
      return applyTemplate_ep2book(state.book.chapterTemplate, tokens);
    }

    function previewPart() {
      const firstTid = state.topicOrder[0];
      const firstTopic = state.topics[firstTid] || {};
      const subject = firstTopic.subject || `Название эпизода`;
      const tokens = { num: 1, numRom: toRoman_ep2book(1), subject: subject, SUBJECT: subject.toUpperCase() };
      return applyTemplate_ep2book(state.book.partTemplate, tokens);
    }

    function redraw() {
      const multi = state.mode === `multi`;
      let html = `<h3>Шаблоны заголовков</h3>`;

      html += `<div class="ep2book-template-row">`
           +  `<label>Шаблон названия главы</label>`
           +  `<input type="text" class="ep2book-template-input ep2book-chapter-template" value="` + escapeHtml_ep2book(state.book.chapterTemplate) + `">`
           +  `<div class="ep2book-token-buttons">`
           +    `<button type="button" class="ep2book-token" data-target="chapter" data-token="{{num}}">{{num}}</button>`
           +    `<button type="button" class="ep2book-token" data-target="chapter" data-token="{{numRom}}">{{numRom}}</button>`
           +    `<button type="button" class="ep2book-token" data-target="chapter" data-token="{{author}}">{{author}}</button>`
           +    `<button type="button" class="ep2book-token" data-target="chapter" data-token="{{AUTHOR}}">{{AUTHOR}}</button>`
           +  `</div>`
           +  `<div class="ep2book-preview-box">Пример: <strong>` + escapeHtml_ep2book(previewChapter()) + `</strong></div>`
           +  `</div>`;

      if (multi) {
        html += `<div class="ep2book-template-row">`
             +  `<label>Шаблон названия части</label>`
             +  `<input type="text" class="ep2book-template-input ep2book-part-template" value="` + escapeHtml_ep2book(state.book.partTemplate) + `">`
             +  `<div class="ep2book-token-buttons">`
             +    `<button type="button" class="ep2book-token" data-target="part" data-token="{{num}}">{{num}}</button>`
             +    `<button type="button" class="ep2book-token" data-target="part" data-token="{{numRom}}">{{numRom}}</button>`
             +    `<button type="button" class="ep2book-token" data-target="part" data-token="{{subject}}">{{subject}}</button>`
             +    `<button type="button" class="ep2book-token" data-target="part" data-token="{{SUBJECT}}">{{SUBJECT}}</button>`
             +  `</div>`
             +  `<div class="ep2book-preview-box">Пример: <strong>` + escapeHtml_ep2book(previewPart()) + `</strong></div>`
             +  `</div>`;

        html += `<div class="ep2book-template-row">`
             +  `<label>Нумерация глав в книге из частей</label>`
             +  `<label><input type="radio" name="ep2book-part-numbering" value="continuous"` + (state.book.partNumbering === `continuous` ? ` checked` : ``) + `> Сквозная</label> `
             +  `<label><input type="radio" name="ep2book-part-numbering" value="per-part"` + (state.book.partNumbering === `per-part` ? ` checked` : ``) + `> Сброс на каждой части</label>`
             +  `</div>`;
      }

      html += `<div class="ep2book-step5-status"></div>`;
      html += `<p><button type="button" class="ep2book-go-step6">Дальше: валидация постов</button></p>`;
      $step.html(html).prop(`hidden`, false);
    }

    $step.on(`input.ep2book-step5`, `.ep2book-chapter-template`, function () {
      state.book.chapterTemplate = $(this).val();
      $step.find(`.ep2book-preview-box`).first().html(`Пример: <strong>` + escapeHtml_ep2book(previewChapter()) + `</strong>`);
    });

    $step.on(`input.ep2book-step5`, `.ep2book-part-template`, function () {
      state.book.partTemplate = $(this).val();
      const $boxes = $step.find(`.ep2book-preview-box`);
      if ($boxes.length > 1) {
        $boxes.eq(1).html(`Пример: <strong>` + escapeHtml_ep2book(previewPart()) + `</strong>`);
      }
    });

    $step.on(`click.ep2book-step5`, `.ep2book-token`, function () {
      const target = $(this).data(`target`);
      const token = $(this).data(`token`);
      const $input = target === `part`
        ? $step.find(`.ep2book-part-template`)
        : $step.find(`.ep2book-chapter-template`);
      insertAtCursor_ep2book($input[0], token);
      $input.trigger(`input`);
    });

    $step.on(`change.ep2book-step5`, `input[name="ep2book-part-numbering"]`, function () {
      state.book.partNumbering = $(this).val();
    });

    $step.on(`click.ep2book-step5`, `.ep2book-go-step6`, function () {
      validateAllPosts_ep2book();
      renderStep6_ep2book();
      showStep(6);
    });

    redraw();
  }

  // ---------- Шаг 6: валидация ----------
  function renderStep6_ep2book() {
    const $step = $('#ep2book-app .ep2book-step[data-step="6"]');
    $step.off(`.ep2book-step6`);

    let html = `<h3>Валидация постов</h3>`;
    html += `<p>Найдено вопросов: <strong>` + state.questions.length + `</strong></p>`;

    if (state.questions.length === 0) {
      html += `<p>Проблемных фрагментов не обнаружено.</p>`;
      html += `<p><button type="button" class="ep2book-go-step7">Дальше: предпросмотр</button></p>`;
    } else {
      const stats = {};
      state.questions.forEach(q => {
        const k = q.type + `:` + q.tag;
        stats[k] = (stats[k] || 0) + 1;
      });
      html += `<p>Сводка:</p><ul>`;
      Object.keys(stats).forEach(k => {
        const parts = k.split(`:`);
        const label = parts[0] === `html`
          ? `[html]-блоки × ` + stats[k]
          : `[` + parts[1] + `]` + (stats[k] > 1 ? ` × ` + stats[k] : ``);
        html += `<li>` + escapeHtml_ep2book(label) + `</li>`;
      });
      html += `</ul>`;
      html += `<p><button type="button" class="ep2book-start-validation">Начать валидацию</button></p>`;
    }

    html += `<div class="ep2book-step6-status"></div>`;
    $step.html(html).prop(`hidden`, false);

    $step.on(`click.ep2book-step6`, `.ep2book-start-validation`, function () {
      continueValidationQueue_ep2book();
    });

    $step.on(`click.ep2book-step6`, `.ep2book-go-step7`, function () {
      renderStep7_ep2book();
      showStep(7);
    });
  }

  function renderStep6Final_ep2book() {
    const $step = $('#ep2book-app .ep2book-step[data-step="6"]');
    $step.off(`.ep2book-step6`);

    let html = `<h3>Валидация завершена</h3>`;
    html += `<p>Обработано вопросов: <strong>` + state.questions.length + `</strong>.</p>`;

    const counts = { keep: 0, delete: 0, replace: 0, text: 0, link: 0 };
    state.questions.forEach(q => {
      if (!q.answer) return;
      counts[q.answer.kind] = (counts[q.answer.kind] || 0) + 1;
    });

    html += `<ul>`;
    if (counts.keep)    html += `<li>Оставлено как есть: ` + counts.keep + `</li>`;
    if (counts.delete)  html += `<li>Удалено: ` + counts.delete + `</li>`;
    if (counts.replace) html += `<li>Заменено своим вариантом: ` + counts.replace + `</li>`;
    if (counts.text)    html += `<li>[html] → текст: ` + counts.text + `</li>`;
    if (counts.link)    html += `<li>[html] → ссылка: ` + counts.link + `</li>`;
    html += `</ul>`;

    html += `<p class="ep2book-muted">Тексты постов обновлены (cleanHtml).</p>`;

    html += `<div class="ep2book-step6-status"></div>`;
    html += `<p><button type="button" class="ep2book-go-step7">Дальше: предпросмотр</button></p>`;
    $step.html(html).prop(`hidden`, false);

    $step.on(`click.ep2book-step6`, `.ep2book-go-step7`, function () {
      renderStep7_ep2book();
      showStep(7);
    });
  }

  // ---------- Шаг 7: предпросмотр и сборка ----------
  function renderStep7_ep2book() {
    const $step = $('#ep2book-app .ep2book-step[data-step="7"]');
    $step.off(`.ep2book-step7`);

    function redraw() {
      const structure = buildBookStructure_ep2book();

      let html = `<h3>Предпросмотр книги</h3>`;

      html += `<div class="ep2book-preview-toc"><strong>Оглавление:</strong>`;
      html += `<ol>`;
      structure.parts.forEach((part, partIdx) => {
        if (state.mode === `multi`) {
          html += `<li>` + escapeHtml_ep2book(buildPartTitle_ep2book(part, partIdx));
          html += `<ol>`;
          part.chapters.forEach(ch => {
            html += `<li>` + escapeHtml_ep2book(ch.title) + `</li>`;
          });
          html += `</ol></li>`;
        } else {
          part.chapters.forEach(ch => {
            html += `<li>` + escapeHtml_ep2book(ch.title) + `</li>`;
          });
        }
      });
      html += `</ol></div>`;

      let firstChapter = null;
      for (let i = 0; i < structure.parts.length && !firstChapter; i++) {
        if (structure.parts[i].chapters.length) firstChapter = structure.parts[i].chapters[0];
      }
      if (firstChapter) {
        html += `<p><strong>Первая глава:</strong> ` + escapeHtml_ep2book(firstChapter.title) + `</p>`;
        html += `<div class="ep2book-preview-chapter">` + firstChapter.html + `</div>`;
      } else {
        html += `<p class="ep2book-err">В книге нет ни одной главы (только титульные посты).</p>`;
      }

      html += `<div class="ep2book-build-status"></div>`;
      html += `<p><button type="button" class="ep2book-download-epub">Скачать .epub</button></p>`;
      html += `<p>`
           +  `<button type="button" class="ep2book-back-to-step4">← Вернуться к параметрам книги</button> `
           +  `<button type="button" class="ep2book-back-to-step5">← Вернуться к заголовкам</button>`
           +  `</p>`;
      $step.html(html).prop(`hidden`, false);
    }

    $step.on(`click.ep2book-step7`, `.ep2book-back-to-step4`, function () {
      renderStep4_ep2book();
      showStep(4);
    });

    $step.on(`click.ep2book-step7`, `.ep2book-back-to-step5`, function () {
      renderStep5_ep2book();
      showStep(5);
    });

    $step.on(`click.ep2book-step7`, `.ep2book-download-epub`, async function () {
      const $btn = $(this);
      const $status = $step.find(`.ep2book-build-status`);
      $btn.prop(`disabled`, true);
      setStatus($status, `Сборка EPUB...`, `ok`);
      try {
        const blob = await buildEpubBlob_ep2book(function (msg) {
          setStatus($status, msg, `ok`);
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement(`a`);
        a.href = url;
        const safeTitle = (state.book.title || `book`).replace(/[\\/:*?"<>|]/g, `_`);
        a.download = safeTitle + `.epub`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 5000);

        let doneMsg = `Готово. Файл: ` + a.download;
        const failed = state.book.failedImages || [];
        if (failed.length) {
          doneMsg += `. Картинок оставлено ссылкой: ` + failed.length;
        }
        setStatus($status, doneMsg, `ok`);
      } catch (err) {
        console.error(`ep2book: ошибка сборки EPUB`, err);
        setStatus($status, `Ошибка сборки: ` + (err && err.message ? err.message : err), `err`);
      } finally {
        $btn.prop(`disabled`, false);
      }
    });

    redraw();
  }

  // ---------- Инициализация ----------
  $(function () {
    const $app = $('#ep2book-app');
    if (!$app.length) return;

    const origin = window.location.origin;
    $app.find(`.ep2book-links-single`).attr(`placeholder`, origin + `/viewtopic.php?id=2008`);
    $app.find(`.ep2book-links-multi`).attr(
      `placeholder`,
      origin + `/viewtopic.php?id=2008\n` + origin + `/viewtopic.php?id=2010`
    );

    showStep(1);
    bindStep1($app);
  });

})(jQuery);

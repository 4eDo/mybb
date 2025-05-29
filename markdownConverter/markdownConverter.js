(function() {
	$("#button-font").after(`<td id="button-markdown" title="Использовать разметку Markdown"><img src="/i/blank.gif"  onclick="bbcode('[markdown]','[/markdown]')"></td>`);

	$('.custom_tag_markdown').each(function() {
		const $block = $(this);
		let htmlContent = markdownToHtml($block.html());
		$block.html(htmlContent);
	});
	
	function markdownToHtml(markdownText) {
		const codeBlocks = [];
		
		markdownText = markdownText.replace(/<br\s*[\/]?>/gi, '\n');
		markdownText = markdownText.replace(/<\/p>\s*[\/]?<p>/g, '\n\n');
		markdownText = markdownText.replace(/<p>/g, '\n');
		markdownText = markdownText.replace(/<\/p>/g, '\n');
		markdownText = markdownText.replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi,
			(match, url, linkText) => url);
		console.log(markdownText);

		markdownText = markdownText.replace(/(^|\n)```([^\n]*)\n([\s\S]*?)```($|\n)/g, (match, p1, lang, code, p4) => {
			const trimmedCode = code;
			codeBlocks.push({
				type: 'multiline',
				lang: lang.trim() || '',
				content: trimmedCode
			});
			return `${p1}%%CODEBLOCK${codeBlocks.length - 1}%%${p4}`;
		});

		markdownText = markdownText.replace(/`([^`]+)`/g, (match, code) => {
			if (!match.includes('%%CODEBLOCK')) {
				codeBlocks.push({
					type: 'inline',
					content: code
				});
				return `%%CODEBLOCK${codeBlocks.length - 1}%%`;
			}
			return match;
		});

		markdownText = markdownText.replace(/&nbsp;/gi, '');
		markdownText = markdownText.replace(/&gt;/gi, '>');

		let html = markdownText;
		
		html = processHeaders(html);
		html = processQuotes(html);
		html = processBIUS(html);
		html = processImages(html);
		html = processLinks(html);
		html = processTables(html);
		html = html.replace(/\[ \]\s*(.+)/gi, '<input type="checkbox" disabled>$1');
		html = html.replace(/\[x\]\s*(.+)/gi, '<input type="checkbox" disabled checked>$1');
		html = html.replace(/^[ \t]*([*\-_])([ \t]*\1){2,}[ \t]*$/gm, '<hr>');
		html = processLists(html);

		html = html.replace(/\n\n/g, '<br>');
		
		html = html.replace(/%%CODEBLOCK(\d+)%%/g, (match, index) => {
			const block = codeBlocks[parseInt(index)];
			if (!block) return match;

			if (block.type === 'multiline') {
				return `<div class="code-box"><span class="codelang">${block.lang}</span><strong class="legend" onclick="md_copyCode(this)">Скопировать код:</strong><div class="blockcode"><div class="scrollbox" style="height: 4.5em"><pre>${block.content}</pre></div></div></div>`;
			} else {
				return `<pre style="display: inline;">${block.content}</pre>`;
			}
		});

		return html;
	}

	function processHeaders(text) {
		return text.replace(/^([ \t]*(?:>[ \t]*)*|(?:[ \t]*[-*+]|\d+\.)[ \t]+)(#+)\s+(.+)$/gm,
			(match, prefix, hashes, content) => {
				const level = hashes.length;
				const isQuote = prefix.includes('>');

				const anchorId = content.toLowerCase()
					.replace(/[^\w\u0400-\u04FF]+/g, '-')
					.replace(/^-+|-+$/g, '');
				let linksHtml = `<span class="markdown-links">
				<span onclick="md_copyHref(this)" class="markdown-url" class="" src="https://forumupload.ru/uploads/001c/02/df/2/277755.png" alt="Копировать ссылку" title="Копировать ссылку" data-href="${anchorId}">&nbsp;</span>
				<span onclick="md_copyHref(this, true)" class="markdown-bb" src="https://forumupload.ru/uploads/001c/02/df/2/277755.png" alt="Копировать BB ссылку" title="Копировать BB ссылку" data-href="${anchorId}" data-content="${escapeHtml(content)}">&nbsp;</span>
			  </span>`;
				let headerHtml;
				switch (level) {
					case 1:
						headerHtml = `<div class="quote-box quote-main"><blockquote><p><span style="display: block; text-align: center"><strong id="${anchorId}">${content}</strong>${linksHtml}</span></p></blockquote></div>`;
						break;
					case 2:
						headerHtml = `<div class="quote-box quote-main"><blockquote><p><strong id="${anchorId}">${content}</strong>${linksHtml}</p></blockquote></div>`;
						break;
					default:
						headerHtml = `<p><strong id="${anchorId}">${content}</strong>${linksHtml}</p>`;
				}

				headerHtml = `<div class="markdown-heading">${headerHtml}</div>
		  `;

				// Сохраняем префикс (отступы + маркеры) для списков
				if (/^(\s*)([-*+]|\d+\.)\s+/.test(prefix)) {
					const [, indent, marker] = prefix.match(/^(\s*)([-*+]|\d+\.)\s+/) || [];
					return `${indent}${marker} ${headerHtml}`;
				}

				return `${prefix}${headerHtml}`;
			}
		);
	}
	function escapeHtml(unsafe) {
		return unsafe
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#039;");
	}

	function processBIUS(text) {
		text = text.replace(/(\*\*|__)(.+?)(\*\*|__)/g, '<strong>$2</strong>');
		text = text.replace(/(\*|_)(.+?)(\*|_)/g, '<span style="font-style: italic">$2</span>');
		text = text.replace(/\+(.+?)\+/g, '<em class="bbuline">$1</em>');
		text = text.replace(/~~(.+?)~~/g, '<del>$1</del>');
		return text;
	}

	function processLinks(text) {
		text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
		return text;
	}

	function processImages(text) {
		text = text.replace(/!\[([^\]]+)\]\(([^)]+)\)/g, '<img class="postimg" loading="lazy" src="$2" alt="$1">');
		return text;
	}

	function processQuotes(text) {
		const quoteRegex = /^\s*(>+)(\s*(.+))?$/gm;
		let lines = text.split('\n');
		let result = '';
		let quoteStack = [];

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const match = quoteRegex.exec(line);
			quoteRegex.lastIndex = 0;

			if (match) {
				const quoteLevel = match[1].length;
				const content = match[3] || '<p></p>';

				while (quoteStack.length > 0 && quoteLevel < quoteStack[quoteStack.length - 1].level) {
					result += '</p></blockquote></div>';
					quoteStack.pop();
				}

				if (quoteStack.length === 0 || quoteLevel > quoteStack[quoteStack.length - 1].level) {
					result += '<div class="quote-box quote-main"><blockquote><p>';
					quoteStack.push({
						level: quoteLevel
					});
				}

				result += content;
			} else {
				while (quoteStack.length > 0) {
					result += '</p></blockquote></div>';
					quoteStack.pop();
				}
				result += line + '\n';
			}
		}

		while (quoteStack.length > 0) {
			result += '</p></blockquote></div>';
			quoteStack.pop();
		}

		return result;
	}

	function processLists(text) {
		const listRegex = /^( *)([-+*]|\d+\.)\s+(.+)$/gm;
		let lines = text.split('\n');
		let result = '';
		let listStack = [];

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const match = listRegex.exec(line);
			listRegex.lastIndex = 0;

			if (match) {
				const indent = match[1].length;
				const marker = match[2];
				const content = match[3];
				const isOrdered = /^\d+\.$/.test(marker);

				while (listStack.length > 0 && indent < listStack[listStack.length - 1].indent) {
					result += listStack[listStack.length - 1].type === 'ul' ? '</ul>' : '</ol>';
					listStack.pop();
				}

				if (listStack.length === 0 || indent > listStack[listStack.length - 1].indent) {
					const listType = isOrdered ? 'ol' : 'ul';
					result += `<${listType}>`;
					listStack.push({
						indent: indent,
						type: listType
					});
				}
				
				else if (listStack.length > 0 &&
					((isOrdered && listStack[listStack.length - 1].type === 'ul') ||
						(!isOrdered && listStack[listStack.length - 1].type === 'ol'))) {
					// Закрываем текущий список
					result += listStack[listStack.length - 1].type === 'ul' ? '</ul>' : '</ol>';
					listStack.pop();
					// Открываем новый список правильного типа
					const listType = isOrdered ? 'ol' : 'ul';
					result += `<${listType}>`;
					listStack.push({
						indent: indent,
						type: listType
					});
				}

				result += '<li>' + content + '</li>';
			} else {
				while (listStack.length > 0) {
					result += listStack[listStack.length - 1].type === 'ul' ? '</ul>' : '</ol>';
					listStack.pop();
				}
				result += line + '\n';
			}
		}

		while (listStack.length > 0) {
			result += listStack[listStack.length - 1].type === 'ul' ? '</ul>' : '</ol>';
			listStack.pop();
		}

		return result;
	}

	function processTables(text) {
		const tableRegex = /\|(.*)\|\n\|(.*)\|\n((?:\|(.*)\|\n)+)/g;

		return text.replace(tableRegex, (match, headers, separator, rows) => {
			const headerCells = headers.split('|').map(h => h.trim()).filter(h => h !== "");
			const rowStrings = rows.trim().split('\n');
			const tableRows = rowStrings.map(row => row.split('|').map(cell => cell.trim()).filter(cell => cell !== ""));

			let tableHTML = '<table><thead><tr>';
			headerCells.forEach(header => {
				tableHTML += `<th>${header}</th>`;
			});
			tableHTML += '</tr></thead><tbody>';

			tableRows.forEach(row => {
				tableHTML += '<tr>';
				row.forEach(cell => {
					tableHTML += `<td>${cell}</td>`;
				});
				tableHTML += '</tr>';
			});

			tableHTML += '</tbody></table>';
			return tableHTML;
		});
	}

}());

function md_copyCode(element) {
	const codeBox = element.closest('.code-box');
	const preElement = codeBox.querySelector('pre');
	const codeText = preElement.textContent;
	const originalText = element.textContent;

	md_copyToClipboard(
		codeText,
		() => md_showFeedback(element, 'Скопировано!', originalText),
		() => md_showFeedback(element, 'Ошибка!', originalText)
	);
}

function md_copyHref(element, isBB = false) {
	const anchorId = element.getAttribute('data-href');
	let fullUrl = `${window.location.origin}${window.location.pathname}${window.location.search}#${anchorId}`;

	if (isBB) {
		fullUrl = `[url=${fullUrl}][b]${document.title}:[/b] ${element.getAttribute('data-content')}[/url]`;
	}

	md_copyToClipboard(
		fullUrl,
		() => {},
		() => {}
	);
	window.location.hash = anchorId;
}

function md_copyToClipboard(text, successCallback, errorCallback) {
	if (navigator.clipboard) {
		navigator.clipboard.writeText(text)
			.then(() => successCallback?.())
			.catch(err => {
				console.error('Ошибка API буфера:', err);
				errorCallback?.();
			});
	} else {
		// Fallback для старых браузеров
		const textarea = document.createElement('textarea');
		textarea.value = text;
		textarea.style.position = 'fixed';
		document.body.appendChild(textarea);
		textarea.select();

		try {
			const success = document.execCommand('copy');
			if (success) successCallback?.();
			else errorCallback?.();
		} catch (err) {
			console.error('Ошибка fallback-копирования:', err);
			errorCallback?.();
		}

		document.body.removeChild(textarea);
	}
}

function md_showFeedback(element, message, originalText) {
	element.textContent = message;
	setTimeout(() => {
		element.textContent = originalText;
	}, 2000);
}

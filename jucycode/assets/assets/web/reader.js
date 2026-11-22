// Runs inside the lesson WebView. Talks to Flutter through the "SH" JavaScript channel.
(function () {
	'use strict';
	var cfg = window.SH_CFG || {};
	function post(obj) {
		try { SH.postMessage(JSON.stringify(obj)); } catch (e) { /* not inside the app */ }
	}
	// A link can point inside a folded explanation. Open every ancestor before scrolling.
	function reveal(el) {
		for (var parent = el.parentElement; parent; parent = parent.parentElement) {
			if (parent.tagName === 'DETAILS') parent.open = true;
			if (parent.classList.contains('sh-sec')) setSectionClosed(parent, false);
		}
	}
	function setSectionClosed(section, closed) {
		section.classList.toggle('closed', closed);
		var heading = section.firstElementChild;
		if (heading && heading.tagName === 'H2') heading.setAttribute('aria-expanded', closed ? 'false' : 'true');
	}

	// ---- statement order & heading language (respects cfg.view: 'bn' | 'en') ----
	try {
		var langView = cfg.view === 'en' ? 'en' : 'bn';
		var enDetails = document.querySelector('details.sh-en-statement');
		if (langView === 'en') {
			if (enDetails) {
				var enSpec = enDetails.querySelector('.sh-problem-spec');
				var bnSpec = document.querySelector('.sh-problem-spec[data-sh-statement-lang="bn"]');
				if (enSpec && bnSpec && bnSpec.parentNode) {
					var bnAcc = document.createElement('details');
					bnAcc.className = 'sh-bn-accordion';
					var bnSum = document.createElement('summary');
					bnSum.textContent = '🇧🇩 বাংলা অনুবাদ (Bengali Translation)';
					bnAcc.appendChild(bnSum);
					bnSpec.parentNode.insertBefore(bnAcc, bnSpec);
					bnAcc.appendChild(bnSpec);

					bnAcc.parentNode.insertBefore(enSpec, bnAcc);
					enDetails.remove();
				} else if (enSpec && enDetails.parentNode) {
					enDetails.parentNode.insertBefore(enSpec, enDetails);
					enDetails.remove();
				}
			}

			var TITLE_MAP = [
				[/🧩\s*সমস্যাটা বুঝি|সমস্যাটা বুঝি/i, '🧩 Problem Statement'],
				[/🧭\s*Pattern চেনার সংকেত|Pattern চেনার সংকেত/i, '🧭 Intuition & Key Pattern'],
				[/🪜\s*সমাধানের পথ|সমাধানের পথ/i, '🪜 Approaches & Solutions'],
				[/⚡?\s*এক নজরে/i, '⚡ Quick Overview'],
				[/💡\s*মূল ধারণা|মূল ধারণা/i, '💡 Core Intuition'],
				[/কেন সঠিক/i, 'Correctness & Invariant'],
				[/সম্পর্কিত problem/i, 'Related Problems'],
				[/প্রয়োজনীয় নিয়ম|প্রয়োজনীয় নিয়ম/i, 'Key Requirements'],
				[/উদাহরণ/i, 'Example'],
				[/ব্যাখ্যা/i, 'Explanation']
			];

			var BN_DIGITS = { '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9' };
			function replaceTextNodes(root) {
				var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
				var node;
				while ((node = walker.nextNode())) {
					var val = node.nodeValue;
					var changed = false;
					TITLE_MAP.forEach(function (pair) {
						if (pair[0].test(val)) {
							val = val.replace(pair[0], pair[1]);
							changed = true;
						}
					});
					if (changed) {
						val = val.replace(/[০-৯]/g, function (d) { return BN_DIGITS[d] || d; });
						node.nodeValue = val;
					}
				}
			}

			document.querySelectorAll('h2, .sh-glance-title, .sh-glance-k, .sh-spec-rules strong, summary').forEach(replaceTextNodes);
		} else if (enDetails) {
			var enSum = enDetails.querySelector('summary');
			if (enSum && !enSum.textContent.trim()) {
				enSum.textContent = '🇬🇧 English Problem Statement';
			}
		}
	} catch (e) { /* ignore */ }

	// ---- Visual Tree Structure for Binary Tree Problems ----
	function parseTreeArray(str) {
		if (!str) return null;
		var raw = str.trim();
		if (!raw) return null;
		var parts = raw.split(',').map(function (s) {
			var t = s.trim();
			if (t === 'null' || t === 'None' || t === '') return null;
			var num = Number(t);
			return isNaN(num) ? t : num;
		});
		if (parts.length === 0 || parts[0] === null) return null;
		return parts;
	}

	function buildTreeSvgCard(varName, arr) {
		if (!arr || arr.length === 0 || arr[0] === null) return null;

		function Node(val, isNull) {
			this.val = val;
			this.isNull = !!isNull;
			this.left = null;
			this.right = null;
			this.x = 0;
			this.y = 0;
		}

		var root = new Node(arr[0], false);
		var queue = [root];
		var i = 1;
		while (queue.length > 0 && i < arr.length) {
			var curr = queue.shift();
			if (curr.isNull) continue;

			// Left child
			if (i < arr.length) {
				var lval = arr[i++];
				if (lval !== null && lval !== undefined) {
					curr.left = new Node(lval, false);
					queue.push(curr.left);
				}
			}
			// Right child
			if (i < arr.length) {
				var rval = arr[i++];
				if (rval !== null && rval !== undefined) {
					curr.right = new Node(rval, false);
					queue.push(curr.right);
				}
			}
		}

		// Add phantom null stubs for single children to make left vs right orientation 100% clear
		function addNullStubs(n) {
			if (!n || n.isNull) return;
			if (n.left && !n.right) {
				n.right = new Node('null', true);
			} else if (n.right && !n.left) {
				n.left = new Node('null', true);
			}
			addNullStubs(n.left);
			addNullStubs(n.right);
		}
		addNullStubs(root);

		// Inorder coordinate assignment for clean collision-free binary tree layout
		var inorderIdx = 0;
		var maxDepth = 0;
		function assignCoords(n, depth) {
			if (!n) return;
			if (depth > maxDepth) maxDepth = depth;
			assignCoords(n.left, depth + 1);
			n.x = inorderIdx++;
			n.y = depth;
			assignCoords(n.right, depth + 1);
		}
		assignCoords(root, 0);

		var nodeCount = inorderIdx;
		var depthCount = maxDepth + 1;

		var colW = Math.max(54, Math.min(68, Math.round(360 / Math.max(nodeCount, 1))));
		var rowH = 76;
		var padX = 36;
		var padY = 40;

		var width = Math.max(260, nodeCount * colW + padX * 2);
		var height = depthCount * rowH + padY * 2;

		var linesSvg = [];
		var badgesSvg = [];
		var nodesSvg = [];

		function traverse(n) {
			if (!n) return;
			var cx = padX + n.x * colW + colW / 2;
			var cy = padY + n.y * rowH + 20;

			var children = [
				{ isLeft: true, child: n.left },
				{ isLeft: false, child: n.right }
			];

			children.forEach(function (item) {
				var ch = item.child;
				if (!ch) return;
				var chCx = padX + ch.x * colW + colW / 2;
				var chCy = padY + ch.y * rowH + 20;

				var isLeft = item.isLeft;
				var stroke = isLeft ? 'var(--sh-tree-left, #38bdf8)' : 'var(--sh-tree-right, #fb923c)';
				var strokeWidth = ch.isNull ? '1.8' : '2.4';
				var dash = ch.isNull ? ' stroke-dasharray="4,4"' : '';
				var opac = ch.isNull ? '0.6' : '0.9';

				var midY = (cy + chCy) / 2;
				var pathD = 'M ' + cx.toFixed(1) + ' ' + cy.toFixed(1) +
							' C ' + cx.toFixed(1) + ' ' + midY.toFixed(1) +
							' ' + chCx.toFixed(1) + ' ' + midY.toFixed(1) +
							' ' + chCx.toFixed(1) + ' ' + chCy.toFixed(1);

				linesSvg.push('<path d="' + pathD + '" fill="none" stroke="' + stroke + '" stroke-width="' + strokeWidth + '"' + dash + ' opacity="' + opac + '" />');

				var mx = (cx + chCx) / 2;
				var my = (cy + chCy) / 2;
				var badgeBg = isLeft ? 'var(--sh-tree-left-badge, #0284c7)' : 'var(--sh-tree-right-badge, #ea580c)';
				var badgeLbl = isLeft ? 'L' : 'R';

				badgesSvg.push(
					'<g class="sh-tree-branch-badge" transform="translate(' + mx.toFixed(1) + ',' + my.toFixed(1) + ')">' +
					'<circle r="8.5" fill="' + badgeBg + '" stroke="var(--bg, #090d16)" stroke-width="1.5"/>' +
					'<text y="3" text-anchor="middle" font-size="8.5" font-weight="800" fill="#ffffff" font-family="-apple-system,system-ui,sans-serif">' + badgeLbl + '</text>' +
					'</g>'
				);

				traverse(ch);
			});

			if (n === root) {
				nodesSvg.push(
					'<g class="sh-tree-root-tag" transform="translate(' + cx.toFixed(1) + ',' + (cy - 24).toFixed(1) + ')">' +
					'<rect x="-18" y="-7" width="36" height="14" rx="7" fill="#6366f1"/>' +
					'<text y="3.5" text-anchor="middle" font-size="8" font-weight="800" fill="#ffffff" font-family="-apple-system,system-ui,sans-serif" letter-spacing="0.5">ROOT</text>' +
					'</g>'
				);
			}

			if (n.isNull) {
				nodesSvg.push(
					'<g class="sh-tree-node sh-tree-node-null" transform="translate(' + cx.toFixed(1) + ',' + cy.toFixed(1) + ')">' +
					'<circle r="14" fill="none" stroke="var(--muted, #64748b)" stroke-width="1.5" stroke-dasharray="3,3" opacity="0.6"/>' +
					'<text y="3.5" text-anchor="middle" font-size="9" fill="var(--muted, #94a3b8)" font-family="ui-monospace,monospace">null</text>' +
					'</g>'
				);
			} else {
				var valStr = String(n.val);
				var fontSz = valStr.length > 3 ? '10' : (valStr.length > 2 ? '11' : '12.5');
				nodesSvg.push(
					'<g class="sh-tree-node sh-tree-node-val" transform="translate(' + cx.toFixed(1) + ',' + cy.toFixed(1) + ')">' +
					'<circle r="16.5" fill="var(--soft, #111827)" stroke="var(--sh-tree-left, #38bdf8)" stroke-width="2"/>' +
					'<text y="4.2" text-anchor="middle" font-size="' + fontSz + '" font-weight="700" fill="var(--fg, #f8fafc)" font-family="-apple-system,system-ui,sans-serif">' + valStr + '</text>' +
					'</g>'
				);
			}
		}
		traverse(root);

		var asciiLines = [];
		function buildAscii(n, prefix, isLeft, isTail) {
			if (!n) return;
			var tag = isLeft === null ? '[ROOT] ' : (isLeft ? '├── (L) ' : '└── (R) ');
			var val = n.isNull ? '(null/empty)' : String(n.val);
			asciiLines.push(prefix + tag + val);
			var childPrefix = prefix + (isLeft === null ? '' : (isLeft ? '│   ' : '    '));
			var children = [];
			if (n.left) children.push({ n: n.left, isLeft: true });
			if (n.right) children.push({ n: n.right, isLeft: false });
			for (var idx = 0; idx < children.length; idx++) {
				buildAscii(children[idx].n, childPrefix, children[idx].isLeft, idx === children.length - 1);
			}
		}
		buildAscii(root, '', null, true);

		var cardHtml = '<div class="sh-tree-card">' +
			'<div class="sh-tree-card-head">' +
				'<div class="sh-tree-title">🌳 Tree Structure: <code>' + varName + '</code></div>' +
				'<div class="sh-tree-legend">' +
					'<span class="sh-legend-item sh-leg-l"><span class="sh-dot sh-dot-l"></span>(L) Left</span>' +
					'<span class="sh-legend-item sh-leg-r"><span class="sh-dot sh-dot-r"></span>(R) Right</span>' +
					'<span class="sh-legend-item sh-leg-null"><span class="sh-dot sh-dot-null"></span>null</span>' +
				'</div>' +
			'</div>' +
			'<div class="sh-tree-viewport">' +
				'<svg class="sh-tree-svg" width="' + width.toFixed(0) + '" height="' + height.toFixed(0) + '" viewBox="0 0 ' + width.toFixed(0) + ' ' + height.toFixed(0) + '" ' +
					 'style="min-width:' + width.toFixed(0) + 'px; height:' + height.toFixed(0) + 'px;" ' +
					 'xmlns="http://www.w3.org/2000/svg">' +
					'<g class="sh-tree-lines">' + linesSvg.join('') + '</g>' +
					'<g class="sh-tree-badges">' + badgesSvg.join('') + '</g>' +
					'<g class="sh-tree-nodes">' + nodesSvg.join('') + '</g>' +
				'</svg>' +
			'</div>' +
			'<details class="sh-tree-ascii-details">' +
				'<summary>Show text / ASCII outline</summary>' +
				'<pre class="sh-tree-ascii"><code>' + asciiLines.join('\n') + '</code></pre>' +
			'</details>' +
		'</div>';

		return cardHtml;
	}

	// Helper to extract a balanced bracket substring [...] starting near startIndex
	function extractBalancedBrackets(text, startIndex) {
		var firstOpen = -1;
		var scanLimit = Math.min(text.length, startIndex + 30);
		for (var k = startIndex; k < scanLimit; k++) {
			var ch = text.charAt(k);
			if (ch === '[') {
				firstOpen = k;
				break;
			}
			if (ch !== ' ' && ch !== '\t' && ch !== '\n' && ch !== '\r' && ch !== '=') {
				return null;
			}
		}
		if (firstOpen === -1) return null;
		var depth = 0;
		for (var i = firstOpen; i < text.length; i++) {
			if (text.charAt(i) === '[') depth++;
			else if (text.charAt(i) === ']') {
				depth--;
				if (depth === 0) {
					return {
						str: text.substring(firstOpen, i + 1),
						endIndex: i + 1
					};
				}
			}
		}
		return null;
	}

	// ---- Visual 2D Grid / Matrix Visualizer ----
	function parseGridArray(str) {
		if (!str) return null;
		var clean = str.trim();
		if (clean.charAt(0) !== '[' || clean.charAt(clean.length - 1) !== ']') return null;
		if (clean.indexOf('[', 1) === -1) return null; // must be a 2D array

		var rowMatches = clean.match(/\[[^\[\]]*\]/g);
		if (!rowMatches || rowMatches.length === 0) return null;

		var grid = [];
		for (var r = 0; r < rowMatches.length; r++) {
			var rowContent = rowMatches[r].slice(1, -1).trim();
			if (!rowContent) continue;
			var cells = rowContent.split(',').map(function (c) {
				return c.trim().replace(/^['"]|['"]$/g, '');
			});
			if (cells.length > 0) grid.push(cells);
		}
		if (grid.length === 0 || grid[0].length === 0) return null;
		return grid;
	}

	function buildGridHtmlCard(varName, grid) {
		if (!grid || grid.length === 0 || grid[0].length === 0) return null;
		var rows = grid.length;
		var cols = grid[0].length;
		if (rows > 20 || cols > 20) return null;

		var isBinary = true;
		var isOranges = false;
		var isChar = false;

		for (var r = 0; r < rows; r++) {
			for (var c = 0; c < grid[r].length; c++) {
				var val = grid[r][c];
				if (val === '2') isOranges = true;
				if (val !== '0' && val !== '1') isBinary = false;
				if (val.length === 1 && /[A-Za-z]/.test(val)) isChar = true;
			}
		}

		var typeBadge = '';
		if (isBinary) {
			typeBadge = '<span class="sh-grid-legend-item"><span class="sh-grid-chip sh-grid-land"></span>1: Land / Active</span>' +
						'<span class="sh-grid-legend-item"><span class="sh-grid-chip sh-grid-water"></span>0: Water / Empty</span>';
		} else if (isOranges) {
			typeBadge = '<span class="sh-grid-legend-item"><span class="sh-grid-chip sh-grid-rotten"></span>2: Rotten</span>' +
						'<span class="sh-grid-legend-item"><span class="sh-grid-chip sh-grid-fresh"></span>1: Fresh</span>' +
						'<span class="sh-grid-legend-item"><span class="sh-grid-chip sh-grid-water"></span>0: Empty</span>';
		}

		var tableHtml = '<table class="sh-grid-table">';
		tableHtml += '<thead><tr><th class="sh-grid-corner">r\\c</th>';
		for (var c = 0; c < cols; c++) {
			tableHtml += '<th class="sh-grid-col-hdr">' + c + '</th>';
		}
		tableHtml += '</tr></thead><tbody>';

		for (var r = 0; r < rows; r++) {
			tableHtml += '<tr><th class="sh-grid-row-hdr">' + r + '</th>';
			for (var c = 0; c < cols; c++) {
				var val = (c < grid[r].length) ? grid[r][c] : '';
				var cellClass = 'sh-grid-cell';
				if (isBinary) {
					cellClass += (val === '1' ? ' sh-cell-land' : ' sh-cell-water');
				} else if (isOranges) {
					cellClass += (val === '2' ? ' sh-cell-rotten' : (val === '1' ? ' sh-cell-fresh' : ' sh-cell-water'));
				} else if (isChar) {
					cellClass += ' sh-cell-char';
				} else if (!isNaN(Number(val))) {
					cellClass += (Number(val) < 0 ? ' sh-cell-neg' : ' sh-cell-num');
				}
				tableHtml += '<td class="' + cellClass + '" title="Row ' + r + ', Col ' + c + ': ' + val + '"><span>' + val + '</span></td>';
			}
			tableHtml += '</tr>';
		}
		tableHtml += '</tbody></table>';

		var cardHtml = '<div class="sh-grid-card">' +
			'<div class="sh-grid-head">' +
				'<div class="sh-grid-title">🗺️ 2D Grid: <code>' + varName + '</code> <span class="sh-grid-dim">(' + rows + ' × ' + cols + ')</span></div>' +
				(typeBadge ? '<div class="sh-grid-legend">' + typeBadge + '</div>' : '') +
			'</div>' +
			'<div class="sh-grid-viewport">' + tableHtml + '</div>' +
		'</div>';

		return cardHtml;
	}

	// ---- Visual Linked List Visualizer ----
	function parseLinkedListArray(str) {
		if (!str) return null;
		var raw = str.trim();
		if (raw.charAt(0) === '[') raw = raw.slice(1);
		if (raw.charAt(raw.length - 1) === ']') raw = raw.slice(0, -1);
		var parts = raw.split(',').map(function (s) {
			var t = s.trim();
			if (t === 'null' || t === 'None' || t === '') return null;
			var num = Number(t);
			return isNaN(num) ? t : num;
		});
		if (parts.length === 0 || parts[0] === null) return null;
		return parts;
	}

	function buildLinkedListCard(varName, arr, cyclePos) {
		if (!arr || arr.length === 0) return null;
		if (arr.length > 25) arr = arr.slice(0, 25);

		var n = arr.length;
		var nodeW = 54;
		var nodeH = 38;
		var gap = 40;
		var padX = 36;
		var padY = 32;

		var hasCycle = (typeof cyclePos === 'number' && cyclePos >= 0 && cyclePos < n);
		var height = hasCycle ? 116 : 80;
		var width = Math.max(260, padX * 2 + n * (nodeW + gap) + (hasCycle ? 20 : 60));

		var nodesSvg = [];
		var arrowsSvg = [];
		var cy = 38;

		for (var i = 0; i < n; i++) {
			var x = padX + i * (nodeW + gap);
			var valStr = String(arr[i]);
			var fontSz = valStr.length > 3 ? '10' : '12';

			nodesSvg.push(
				'<g class="sh-ll-node" transform="translate(' + x + ',' + (cy - nodeH / 2) + ')">' +
				'<rect x="0" y="0" width="' + (nodeW - 14) + '" height="' + nodeH + '" rx="6" fill="var(--soft, #111827)" stroke="var(--sh-tree-left, #38bdf8)" stroke-width="1.8"/>' +
				'<rect x="' + (nodeW - 14) + '" y="0" width="14" height="' + nodeH + '" rx="4" fill="var(--code-bg, #1e293b)" stroke="var(--sh-tree-left, #38bdf8)" stroke-width="1.8"/>' +
				'<circle cx="' + (nodeW - 7) + '" cy="' + (nodeH / 2) + '" r="2.5" fill="var(--sh-tree-left, #38bdf8)"/>' +
				'<text x="' + ((nodeW - 14) / 2) + '" y="' + (nodeH / 2 + 4.5) + '" text-anchor="middle" font-size="' + fontSz + '" font-weight="700" fill="var(--fg, #f8fafc)" font-family="sans-serif">' + valStr + '</text>' +
				'<text x="' + (nodeW / 2) + '" y="' + (nodeH + 13) + '" text-anchor="middle" font-size="8.5" fill="var(--muted, #64748b)" font-family="monospace">#' + i + '</text>' +
				'</g>'
			);

			if (i === 0) {
				nodesSvg.push(
					'<g class="sh-ll-head-tag" transform="translate(' + (x + (nodeW - 14) / 2) + ',' + (cy - nodeH / 2 - 8) + ')">' +
					'<rect x="-18" y="-7" width="36" height="13" rx="6" fill="#6366f1"/>' +
					'<text y="3" text-anchor="middle" font-size="8" font-weight="800" fill="#ffffff" font-family="sans-serif">HEAD</text>' +
					'</g>'
				);
			}

			if (i < n - 1) {
				var startX = x + nodeW;
				var endX = startX + gap;
				arrowsSvg.push(
					'<g class="sh-ll-arrow">' +
					'<line x1="' + startX + '" y1="' + cy + '" x2="' + (endX - 6) + '" y2="' + cy + '" stroke="var(--sh-tree-left, #38bdf8)" stroke-width="2"/>' +
					'<polygon points="' + (endX - 6) + ',' + (cy - 4) + ' ' + endX + ',' + cy + ' ' + (endX - 6) + ',' + (cy + 4) + '" fill="var(--sh-tree-left, #38bdf8)"/>' +
					'</g>'
				);
			}
		}

		var lastX = padX + (n - 1) * (nodeW + gap) + nodeW;
		if (hasCycle) {
			var targetX = padX + cyclePos * (nodeW + gap) + (nodeW - 14) / 2;
			var bottomY = cy + 44;
			var pathD = 'M ' + lastX + ' ' + cy +
						' H ' + (lastX + 16) +
						' Q ' + (lastX + 26) + ' ' + cy + ' ' + (lastX + 26) + ' ' + (cy + 10) +
						' V ' + (bottomY - 10) +
						' Q ' + (lastX + 26) + ' ' + bottomY + ' ' + (lastX + 16) + ' ' + bottomY +
						' H ' + (targetX + 6) +
						' Q ' + targetX + ' ' + bottomY + ' ' + targetX + ' ' + (bottomY - 10) +
						' V ' + (cy + nodeH / 2 + 5);

			arrowsSvg.push(
				'<g class="sh-ll-cycle-arrow">' +
				'<path d="' + pathD + '" fill="none" stroke="#f59e0b" stroke-width="2.2" stroke-dasharray="4,3"/>' +
				'<polygon points="' + (targetX - 4) + ',' + (cy + nodeH / 2 + 5) + ' ' + targetX + ',' + (cy + nodeH / 2) + ' ' + (targetX + 4) + ',' + (cy + nodeH / 2 + 5) + '" fill="#f59e0b"/>' +
				'<rect x="' + ((lastX + targetX) / 2 - 42) + '" y="' + (bottomY - 9) + '" width="84" height="17" rx="8" fill="#f59e0b"/>' +
				'<text x="' + ((lastX + targetX) / 2) + '" y="' + (bottomY + 3.5) + '" text-anchor="middle" font-size="8.5" font-weight="800" fill="#000000" font-family="sans-serif">↺ CYCLE TO #' + cyclePos + '</text>' +
				'</g>'
			);
		} else {
			var nullX = lastX + gap;
			arrowsSvg.push(
				'<g class="sh-ll-arrow">' +
				'<line x1="' + lastX + '" y1="' + cy + '" x2="' + (nullX - 6) + '" y2="' + cy + '" stroke="var(--sh-tree-left, #38bdf8)" stroke-width="2"/>' +
				'<polygon points="' + (nullX - 6) + ',' + (cy - 4) + ' ' + nullX + ',' + cy + ' ' + (nullX - 6) + ',' + (cy + 4) + '" fill="var(--sh-tree-left, #38bdf8)"/>' +
				'<rect x="' + nullX + '" y="' + (cy - 12) + '" width="36" height="24" rx="6" fill="none" stroke="var(--muted, #64748b)" stroke-width="1.5" stroke-dasharray="3,3"/>' +
				'<text x="' + (nullX + 18) + '" y="' + (cy + 4) + '" text-anchor="middle" font-size="9" fill="var(--muted, #64748b)" font-family="monospace">null</text>' +
				'</g>'
			);
		}

		var cardHtml = '<div class="sh-ll-card">' +
			'<div class="sh-ll-head">' +
				'<div class="sh-ll-title">🔗 Linked List: <code>' + varName + '</code> <span class="sh-ll-len">(' + n + ' nodes)</span></div>' +
				(hasCycle ? '<span class="sh-ll-cycle-badge">↺ Has Cycle (pos = ' + cyclePos + ')</span>' : '') +
			'</div>' +
			'<div class="sh-ll-viewport">' +
				'<svg class="sh-ll-svg" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '" ' +
					 'style="min-width:' + width + 'px; height:' + height + 'px;" xmlns="http://www.w3.org/2000/svg">' +
					arrowsSvg.join('') +
					nodesSvg.join('') +
				'</svg>' +
			'</div>' +
		'</div>';

		return cardHtml;
	}

	// ---- Visual Intervals Timeline Visualizer ----
	function parseIntervalsArray(str) {
		if (!str) return null;
		var clean = str.replace(/\s+/g, ' ').trim();
		var rowMatches = clean.match(/\[\s*(-?\d+)\s*,\s*(-?\d+)\s*\]/g);
		if (!rowMatches || rowMatches.length === 0) return null;

		var intervals = [];
		for (var i = 0; i < rowMatches.length; i++) {
			var pairMatch = rowMatches[i].match(/\[\s*(-?\d+)\s*,\s*(-?\d+)\s*\]/);
			if (pairMatch) {
				intervals.push([parseInt(pairMatch[1], 10), parseInt(pairMatch[2], 10)]);
			}
		}
		return intervals.length > 0 ? intervals : null;
	}

	function buildIntervalsSvgCard(varName, intervals) {
		if (!intervals || intervals.length === 0) return null;
		if (intervals.length > 25) intervals = intervals.slice(0, 25);

		var minVal = Infinity;
		var maxVal = -Infinity;
		for (var i = 0; i < intervals.length; i++) {
			if (intervals[i][0] < minVal) minVal = intervals[i][0];
			if (intervals[i][1] > maxVal) maxVal = intervals[i][1];
		}

		if (minVal === Infinity || maxVal === -Infinity || minVal >= maxVal) {
			maxVal = minVal + 1;
		}

		var range = maxVal - minVal;
		var width = Math.max(300, Math.min(500, intervals.length * 70));
		var padLeft = 44;
		var padRight = 30;
		var usableWidth = width - padLeft - padRight;

		var rowHeight = 30;
		var topOffset = 22;
		var height = topOffset + intervals.length * rowHeight + 36;

		function scaleX(val) {
			return padLeft + ((val - minVal) / range) * usableWidth;
		}

		var svgParts = [];

		// Background timeline grid lines
		var ticks = Math.min(range, 8);
		var step = range / ticks;
		for (var t = 0; t <= ticks; t++) {
			var val = Math.round(minVal + t * step);
			var tx = scaleX(val);
			svgParts.push('<line x1="' + tx.toFixed(1) + '" y1="' + (topOffset - 6) + '" x2="' + tx.toFixed(1) + '" y2="' + (height - 24) + '" stroke="var(--border, #334155)" stroke-width="1" stroke-dasharray="2,3"/>');
			svgParts.push('<text x="' + tx.toFixed(1) + '" y="' + (height - 10) + '" text-anchor="middle" font-size="9" fill="var(--muted, #64748b)" font-family="monospace">' + val + '</text>');
		}

		var colors = [
			{ fill: 'rgba(56, 189, 248, 0.25)', stroke: '#38bdf8' },
			{ fill: 'rgba(168, 85, 247, 0.25)', stroke: '#a855f7' },
			{ fill: 'rgba(234, 88, 12, 0.25)', stroke: '#ea580c' },
			{ fill: 'rgba(16, 185, 129, 0.25)', stroke: '#10b981' },
			{ fill: 'rgba(236, 72, 153, 0.25)', stroke: '#ec4899' },
			{ fill: 'rgba(245, 158, 11, 0.25)', stroke: '#f59e0b' }
		];

		// Draw each interval bar
		for (var j = 0; j < intervals.length; j++) {
			var start = intervals[j][0];
			var end = intervals[j][1];
			var x1 = scaleX(start);
			var x2 = scaleX(end);
			var barW = Math.max(16, x2 - x1);
			var y = topOffset + j * rowHeight;
			var c = colors[j % colors.length];

			svgParts.push('<g class="sh-interval-bar">');
			svgParts.push('<rect x="' + x1.toFixed(1) + '" y="' + y + '" width="' + barW.toFixed(1) + '" height="20" rx="6" fill="' + c.fill + '" stroke="' + c.stroke + '" stroke-width="1.8"/>');
			svgParts.push('<text x="' + (x1 + barW / 2).toFixed(1) + '" y="' + (y + 14) + '" text-anchor="middle" font-size="10" font-weight="700" fill="var(--fg, #f8fafc)" font-family="monospace">[' + start + ', ' + end + ']</text>');
			svgParts.push('<text x="' + (padLeft - 8) + '" y="' + (y + 14) + '" text-anchor="end" font-size="9" fill="var(--muted, #64748b)" font-family="monospace">#' + j + '</text>');
			svgParts.push('</g>');
		}

		var cardHtml = '<div class="sh-interval-card">' +
			'<div class="sh-interval-head">' +
				'<div class="sh-interval-title">📏 Intervals Timeline: <code>' + varName + '</code> <span class="sh-interval-count">(' + intervals.length + ' spans, [' + minVal + ' → ' + maxVal + '])</span></div>' +
			'</div>' +
			'<div class="sh-interval-viewport">' +
				'<svg class="sh-interval-svg" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '" ' +
					 'style="min-width:' + width + 'px; height:' + height + 'px;" xmlns="http://www.w3.org/2000/svg">' +
					svgParts.join('') +
				'</svg>' +
			'</div>' +
		'</div>';

		return cardHtml;
	}

	function renderTreeVisualizations() {
		try {
			var treeRegex = /\b(root[0-9]*|p|q|subRoot|tree[0-9]*)\s*=\s*\[([0-9a-zA-Z_,\s\-nullNone]*)\]/g;
			var gridRegex = /\b(grid|matrix|board|maze)\s*=\s*/g;
			var llRegex = /\b(head[A-Za-z0-9_]*|list[0-9]*|l1|l2|node)\s*=\s*/g;
			var intervalRegex = /\b(intervals|firstList|secondList|points|pairs|schedule|meetings|clips)\s*=\s*/g;

			function processBlock(container, targetInsert) {
				if (!container || !targetInsert) return;
				var text = container.textContent || '';
				if (!text || text.indexOf('=') === -1) return;

				function appendCard(html) {
					if (!html) return;
					var wrap = document.createElement('div');
					wrap.innerHTML = html;
					var card = wrap.firstElementChild;
					if (targetInsert.parentNode) {
						targetInsert.parentNode.insertBefore(card, targetInsert.nextSibling);
						targetInsert = card; // subsequent cards insert after this one
					}
				}

				// 1. Check for Intervals Timeline
				intervalRegex.lastIndex = 0;
				var im;
				while ((im = intervalRegex.exec(text)) !== null) {
					var intName = im[1];
					var intBracket = extractBalancedBrackets(text, im.index + im[0].length);
					if (intBracket) {
						intervalRegex.lastIndex = Math.max(intervalRegex.lastIndex, intBracket.endIndex);
						var parsedInts = parseIntervalsArray(intBracket.str);
						if (parsedInts) {
							appendCard(buildIntervalsSvgCard(intName, parsedInts));
						}
					}
				}

				// 2. Check for 2D Grids / Matrices
				gridRegex.lastIndex = 0;
				var gm;
				while ((gm = gridRegex.exec(text)) !== null) {
					var varName = gm[1];
					var bracketInfo = extractBalancedBrackets(text, gm.index + gm[0].length);
					if (bracketInfo) {
						gridRegex.lastIndex = Math.max(gridRegex.lastIndex, bracketInfo.endIndex);
						var parsedGrid = parseGridArray(bracketInfo.str);
						if (parsedGrid) {
							appendCard(buildGridHtmlCard(varName, parsedGrid));
						}
					}
				}

				// 3. Check for Linked Lists
				llRegex.lastIndex = 0;
				var lm;
				while ((lm = llRegex.exec(text)) !== null) {
					var llName = lm[1];
					var llBracket = extractBalancedBrackets(text, lm.index + lm[0].length);
					if (llBracket) {
						llRegex.lastIndex = Math.max(llRegex.lastIndex, llBracket.endIndex);
						var parsedLL = parseLinkedListArray(llBracket.str);
						if (parsedLL) {
							var afterStr = text.substring(llBracket.endIndex);
							var cycleMatch = afterStr.match(/^\s*,\s*pos\s*=\s*(-?\d+)/);
							var cyclePos = cycleMatch ? parseInt(cycleMatch[1], 10) : -1;
							appendCard(buildLinkedListCard(llName, parsedLL, cyclePos));
						}
					}
				}

				// 4. Check for Binary Trees
				treeRegex.lastIndex = 0;
				var tm;
				while ((tm = treeRegex.exec(text)) !== null) {
					var treeName = tm[1];
					var treeArrStr = tm[2];
					var parsedTree = parseTreeArray(treeArrStr);
					if (parsedTree) {
						appendCard(buildTreeSvgCard(treeName, parsedTree));
					}
				}
			}

			// Process all .sh-spec-example blocks
			document.querySelectorAll('.sh-spec-example').forEach(function (ex) {
				if (ex.dataset && ex.dataset.shVisualsDone) return;
				if (ex.dataset) ex.dataset.shVisualsDone = 'true';
				var pre = ex.querySelector('pre');
				if (pre && pre.dataset) pre.dataset.shVisualsDone = 'true';
				processBlock(ex, pre || ex);
			});

			// Also process any other pre blocks inside problem statement
			document.querySelectorAll('.sh-problem-spec pre, .sh-problem-view pre').forEach(function (pre) {
				if (pre.dataset && pre.dataset.shVisualsDone) return;
				if (pre.dataset) pre.dataset.shVisualsDone = 'true';
				processBlock(pre, pre);
			});
		} catch (e) { /* ignore visualization errors */ }
	}
	renderTreeVisualizations();

	// ---- bn / en view switch (problem pages) ----
	function setView(v, notify) {
		document.body.dataset.view = v;
		document.querySelectorAll('.sh-doc-tab').forEach(function (b) {
			var on = b.dataset.shView === v;
			b.classList.toggle('active', on);
			b.setAttribute('aria-selected', on ? 'true' : 'false');
		});
		if (notify) post({ t: 'pref', key: 'view', value: v });
	}
	setView(cfg.view || 'bn', false);

	// Approach selection is independent of the code-language selection.
	document.querySelectorAll('.sh-solution-tabs').forEach(function (list) {
		var tabs = Array.from(list.querySelectorAll('[role="tab"]'));
		function selectApproach(tab, notify) {
			tabs.forEach(function (item) {
				var selected = item === tab;
				item.setAttribute('aria-selected', String(selected));
				item.tabIndex = selected ? 0 : -1;
				var panel = document.getElementById(item.getAttribute('aria-controls'));
				if (panel) panel.hidden = !selected;
			});
			if (notify && cfg.slug) post({ t: 'pref', key: 'approach:' + cfg.slug, value: tab.dataset.approach });
		}
		tabs.forEach(function (tab, index) {
			tab.addEventListener('click', function () { selectApproach(tab, true); });
			tab.addEventListener('keydown', function (event) {
				var next = index;
				if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
				else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
				else if (event.key === 'Home') next = 0;
				else if (event.key === 'End') next = tabs.length - 1;
				else return;
				event.preventDefault();
				selectApproach(tabs[next], true);
				tabs[next].focus();
			});
		});
		if (tabs.length) selectApproach(tabs.find(function (tab) { return tab.dataset.approach === cfg.solutionApproach; }) || tabs[0], false);
	});

	// ---- Python / Java code tabs ----
	var boxes = [];
	document.querySelectorAll('.shcodetabs').forEach(function (box) {
		var pres = Array.prototype.filter.call(box.children, function (n) { return n.tagName === 'PRE'; });
		if (pres.length < 1) return;
		var bar = document.createElement('div');
		bar.className = 'sh-tabbar';
		pres.forEach(function (pre, i) {
			var b = document.createElement('button');
			b.type = 'button';
			b.textContent = pre.dataset.title || (i === 0 ? 'Python' : (i === 1 ? 'Java' : 'Code ' + (i + 1)));
			b.dataset.title = b.textContent;
			bar.appendChild(b);
		});
		var copyBtn = document.createElement('button');
		copyBtn.type = 'button';
		copyBtn.className = 'sh-copy-btn';
		copyBtn.textContent = '📋 Copy';
		copyBtn.title = 'Copy code';
		copyBtn.addEventListener('click', function (ev) {
			ev.stopPropagation();
			var activePre = pres.find(function (p) { return p.style.display !== 'none'; }) || pres[0];
			var code = activePre ? (activePre.querySelector('code') || activePre) : null;
			var txt = code ? (code.innerText || code.textContent) : '';
			post({ t: 'copy', text: txt.trim() });
		});
		bar.appendChild(copyBtn);
		box.insertBefore(bar, pres[0]);
		boxes.push({ pres: pres, bar: bar });
	});
	function selectLang(title, notify) {
		boxes.forEach(function (bx) {
			var idx = bx.pres.findIndex(function (p) { return p.dataset.title === title; });
			if (idx < 0 && title) {
				idx = bx.pres.findIndex(function (p) { return (p.dataset.title || '').indexOf(title) === 0; });
			}
			if (idx < 0) idx = 0;
			bx.pres.forEach(function (p, j) { p.style.display = j === idx ? '' : 'none'; });
			Array.prototype.forEach.call(bx.bar.children, function (b, j) { b.classList.toggle('active', j === idx); });
		});
		if (notify && (title === 'Python' || title === 'Java')) {
			post({ t: 'pref', key: 'codeLang', value: title });
		}
	}
	selectLang(cfg.codeLang || 'Python', false);

	// ---- clicks: view tabs, code tabs, links ----
	document.addEventListener('click', function (e) {
		var tab = e.target.closest('.sh-doc-tab');
		if (tab) { setView(tab.dataset.shView, true); return; }
		var cb = e.target.closest('.sh-tabbar button');
		if (cb) { selectLang(cb.dataset.title, true); return; }
		var h = e.target.closest('.sh-sec > h2');
		if (h) { setSectionClosed(h.parentNode, !h.parentNode.classList.contains('closed')); return; }
		var a = e.target.closest('a[href]');
		if (!a) return;
		e.preventDefault();
		var href = a.getAttribute('href');
		if (href.charAt(0) === '#') {
			var el = document.getElementById(decodeURIComponent(href.slice(1)));
			if (el) { reveal(el); el.scrollIntoView(); }
			return;
		}
		post({ t: 'link', href: href });
	});
	document.addEventListener('keydown', function (e) {
		if (e.key !== 'Enter' && e.key !== ' ') return;
		var h = e.target.closest('.sh-sec > h2');
		if (h) { e.preventDefault(); setSectionClosed(h.parentNode, !h.parentNode.classList.contains('closed')); }
	});

	// ---- progress marks in problem-list tables ----
	window.shSetStatuses = function (done) {
		var set = {};
		(done || []).forEach(function (s) { set[s] = true; });
		document.querySelectorAll('tr[data-lesson]').forEach(function (tr) {
			var on = !!set[tr.dataset.lesson];
			tr.dataset.done = on ? '1' : '0';
			var cell = tr.querySelector('.sh-status');
			if (cell) cell.textContent = on ? '✓' : '';
		});
	};
	window.shSetStatuses(cfg.done);

	// ---- collapsible sections (problem pages) + table of contents ----
	// Secondary parts of a long guide start folded; the essentials stay open.
	var FOLDED = /dry run|কেন সঠিক|Correctness|Invariant|Follow-up|Edge case|সম্পর্কিত problem|Related Problems/i;
	var STATEMENT = /Problem Statement|সমস্যাটা বুঝি/i;
	if (cfg.kind === 'problem') {
		Array.prototype.slice.call(document.querySelectorAll('h2')).forEach(function (h, index) {
			var parent = h.parentNode;
			var sec = document.createElement('section');
			sec.className = 'sh-sec';
			var body = document.createElement('div');
			body.className = 'sh-sec-body';
			body.id = 'sh-sec-body-' + index;
			var inner = document.createElement('div');
			inner.className = 'sh-sec-inner';
			body.appendChild(inner);
			parent.insertBefore(sec, h);
			sec.appendChild(h);
			sec.appendChild(body);
			h.setAttribute('role', 'button');
			h.setAttribute('tabindex', '0');
			h.setAttribute('aria-controls', body.id);
			setSectionClosed(sec, cfg.practice ? !STATEMENT.test(h.textContent) : FOLDED.test(h.textContent));
			var n = sec.nextSibling;
			while (n && !(n.nodeType === 1 && n.tagName === 'H2')) {
				var next = n.nextSibling;
				inner.appendChild(n);
				n = next;
			}
		});

		// Reorder: Move Quick Overview (.sh-glance) so Problem Statement appears first at the top
		var glance = Array.from(document.querySelectorAll('.sh-glance')).find(function (card) {
			return !card.closest('details.sh-original-code');
		});
		var stmtSec = null;
		var allSecs = document.querySelectorAll('.sh-sec');
		for (var sIdx = 0; sIdx < allSecs.length; sIdx++) {
			var heading = allSecs[sIdx].firstElementChild;
			if (heading && STATEMENT.test(heading.textContent)) {
				stmtSec = allSecs[sIdx];
				break;
			}
		}
		if (glance && stmtSec && stmtSec.parentNode) {
			stmtSec.parentNode.insertBefore(glance, stmtSec.nextSibling);
		}
	}
	// Starting practice closes the solution sections; each heading can then be opened individually.
	window.shSetPractice = function (enabled) {
		if (cfg.kind !== 'problem') return;
		cfg.practice = !!enabled;
		// The glance card contains the pattern and solution idea before the first heading.
		Array.prototype.forEach.call(document.querySelectorAll('.sh-glance'), function (card) {
			card.hidden = cfg.practice;
		});
		Array.prototype.forEach.call(document.querySelectorAll('.sh-sec'), function (sec) {
			var heading = sec.firstElementChild;
			if (!heading || heading.tagName !== 'H2') return;
			setSectionClosed(sec, cfg.practice ? !STATEMENT.test(heading.textContent) : FOLDED.test(heading.textContent));
		});
	};
	if (cfg.kind === 'problem') window.shSetPractice(!!cfg.practice);
	var toc = [];
	Array.prototype.forEach.call(document.querySelectorAll('h2, h3'), function (h, i) {
		if (h.closest('.sh-page-head') || h.closest('details')) return;
		if (h.tagName === 'H3' && cfg.kind === 'problem') return;
		if (!h.id) h.id = 'sh-h-' + i;
		toc.push({ id: h.id, text: h.textContent.replace(/\s+/g, ' ').trim(), level: h.tagName === 'H2' ? 2 : 3 });
	});
	window.shGoto = function (id) {
		var el = document.getElementById(id);
		if (!el) return;
		reveal(el);
		var sec = el.closest('.sh-sec');
		if (sec) setSectionClosed(sec, false);
		setTimeout(function () {
			el.scrollIntoView({ behavior: 'smooth', block: 'start' });
			el.classList.add('flash');
			setTimeout(function () { el.classList.remove('flash'); }, 1400);
		}, sec ? 60 : 0);
	};

	// ---- reading position ----
	var timer = null;
	window.addEventListener('scroll', function () {
		clearTimeout(timer);
		timer = setTimeout(function () {
			var max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
			post({ t: 'scroll', y: Math.round(window.scrollY), frac: Math.min(1, window.scrollY / max) });
		}, 350);
	}, { passive: true });
	if (cfg.scrollY > 0) window.scrollTo(0, cfg.scrollY);
	if (cfg.anchor) {
		var t = document.getElementById(cfg.anchor);
		if (t) { reveal(t); t.scrollIntoView(); }
	}
	// ---- scroll-reveal animation ----
	var targets = document.querySelectorAll('[class^="shbox-"], [class*=" shbox-"], .sh-approach, .sh-glance, .sh-problem-spec, .sh-qa, pre, table, h2, h3, .katex-display, details.sh-original-code');
	if ('IntersectionObserver' in window && !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) {
		var io = new IntersectionObserver(function (entries) {
			entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
		}, { rootMargin: '0px 0px -8% 0px', threshold: 0.04 });
		targets.forEach(function (el) {
			var r = el.getBoundingClientRect();
			if (r.top < window.innerHeight) return; // already on screen: no animation, no flash
			el.classList.add('rv'); io.observe(el);
		});
	}

	// ---- Companies & Importance Header Strip ----
	if (cfg.kind === 'problem' && cfg.companies && cfg.companies.length > 0) {
		try {
			var compBox = document.createElement('div');
			compBox.className = 'sh-company-box';

			var compHead = document.createElement('div');
			compHead.className = 'sh-company-head';
			var isEn = cfg.view === 'en';
			var totalC = cfg.totalCompanies || cfg.companies.length;
			var titleSpan = document.createElement('span');
			titleSpan.className = 'sh-company-title';
			titleSpan.textContent = isEn
				? ('🏢 Asked by ' + totalC + (totalC === 1 ? ' Company' : ' Companies'))
				: ('🏢 ' + totalC + 'টি কোম্পানিতে এসেছে (গুরুত্বসহ)');
			compHead.appendChild(titleSpan);

			var allBtn = document.createElement('button');
			allBtn.type = 'button';
			allBtn.className = 'sh-company-all-btn';
			allBtn.textContent = isEn ? 'View all →' : 'সব দেখুন →';
			allBtn.addEventListener('click', function () {
				post({ t: 'showCompanies' });
			});
			compHead.appendChild(allBtn);
			compBox.appendChild(compHead);

			var pills = document.createElement('div');
			pills.className = 'sh-company-pills';
			cfg.companies.forEach(function (c) {
				var btn = document.createElement('button');
				btn.type = 'button';
				btn.className = 'sh-company-pill sh-imp-' + (c.imp || 1);
				btn.title = c.name + ' · ' + c.stars + (c.freq ? (' · ' + c.freq + '%') : '') + (c.recent ? (' · ' + c.recent) : '');
				var label = '<span class="sh-comp-name">' + c.name + '</span>' +
					'<span class="sh-comp-stars">' + (c.stars || '★') + '</span>' +
					(c.freq ? '<span class="sh-comp-freq">' + c.freq + '%</span>' : '') +
					(c.recent ? '<span class="sh-comp-recent">' + c.recent + '</span>' : '');
				btn.innerHTML = label;
				btn.addEventListener('click', function () {
					post({ t: 'company', id: c.id });
				});
				pills.appendChild(btn);
			});
			if (totalC > cfg.companies.length) {
				var moreBtn = document.createElement('button');
				moreBtn.type = 'button';
				moreBtn.className = 'sh-company-pill sh-company-more';
				moreBtn.textContent = '+' + (totalC - cfg.companies.length) + (isEn ? ' more' : ' আরও');
				moreBtn.addEventListener('click', function () {
					post({ t: 'showCompanies' });
				});
				pills.appendChild(moreBtn);
			}
			compBox.appendChild(pills);

			var anchorEl = document.querySelector('.sh-page-head') || document.querySelector('.sh-eyebrow') || document.querySelector('h1');
			if (anchorEl && anchorEl.parentNode) {
				anchorEl.parentNode.insertBefore(compBox, anchorEl.nextSibling);
			} else if (document.body.firstChild) {
				document.body.insertBefore(compBox, document.body.firstChild);
			}
		} catch (e) { /* ignore company bar errors */ }
	}

	// ---- Related Problems Learning Ladder Footer ----
	if (cfg.kind === 'problem' && cfg.related && cfg.related.length > 0) {
		try {
			var ladder = document.createElement('div');
			ladder.className = 'sh-related-ladder';

			var head = document.createElement('div');
			head.className = 'sh-related-head';
			head.innerHTML = '<span class="sh-related-badge">🔗 Learning Ladder</span>' +
				'<div class="sh-related-sub">Master <strong>' + (cfg.patternName || 'this pattern') + '</strong> step-by-step:</div>';
			ladder.appendChild(head);

			var list = document.createElement('div');
			list.className = 'sh-related-list';

			cfg.related.forEach(function (r) {
				var a = document.createElement('a');
				a.className = 'sh-related-card';
				a.href = '/' + r.slug;

				var roleClass = 'sh-role-' + (r.role.toLowerCase().replace(/[^a-z0-9]/g, '-'));
				var diffClass = 'sh-diff-' + r.diff.toLowerCase();

				var displayName = (r.number && !r.title.startsWith(r.number)) ? ('#' + r.number + '. ' + r.title) : r.title;
				a.innerHTML = '<div class="sh-related-top">' +
					'<span class="sh-related-role ' + roleClass + '">' + r.role + '</span>' +
					'<span class="sh-diff ' + diffClass + '">' + r.diff + '</span>' +
					(r.done ? '<span class="sh-related-done">✓ Solved</span>' : '<span class="sh-related-todo">To-Do</span>') +
					'</div>' +
					'<div class="sh-related-name">' + displayName + '</div>' +
					'<div class="sh-related-rationale">' + r.rationale + '</div>';

				list.appendChild(a);
			});

			ladder.appendChild(list);
			document.body.appendChild(ladder);
		} catch (e) { /* ignore */ }
	}

	post({ t: 'ready', toc: toc });
})();

# Convert PRD.md to HTML and then PDF using Microsoft Edge headless

# run this command to powershell to generate PDF:
# powershell -ExecutionPolicy Bypass -File "g:\My Drive\Nawabpur Complex Accessories\ncamart\build_prd_pdf.ps1"

$ErrorActionPreference = "Stop"
$scriptDir = "g:\My Drive\Nawabpur Complex Accessories\ncamart"

$mdPath = Join-Path $scriptDir "PRD.md"
$htmlPath = Join-Path $scriptDir "NCAMart_PRD_v1.4.html"
$pdfPath = Join-Path $scriptDir "NCAMart_PRD_v1.4.pdf"

Write-Host "Reading PRD from: $mdPath"
$lines = [System.IO.File]::ReadAllLines($mdPath, [System.Text.Encoding]::UTF8)

$charCheck = [string][char]0x2705
$charCross = [string][char]0x274C
$charDash = [char]0x2500
$charDown = [char]0x25BC
$charPipe = [char]0x2502

function Format-Inline ([string]$text) {
  if ([string]::IsNullOrEmpty($text)) { return "" }
    
  # Escape HTML special chars first
  $text = [System.Net.WebUtility]::HtmlEncode($text)
    
  # Inline code
  $text = [regex]::Replace($text, '`([^`]+)`', '<code>$1</code>')
    
  # Bold italic
  $text = [regex]::Replace($text, '\*\*\*([^\*]+)\*\*\*', '<strong><em>$1</em></strong>')
    
  # Bold
  $text = [regex]::Replace($text, '\*\*([^\*]+)\*\*', '<strong>$1</strong>')
    
  # Italic
  $text = [regex]::Replace($text, '\*([^\*]+)\*', '<em>$1</em>')
    
  # Markdown Links
  $text = [regex]::Replace($text, '\[([^\]]+)\]\(([^)]+)\)', '<a href="$2">$1</a>')
    
  # Emoticons / Badges
  $text = $text.Replace($charCheck, '<span class="status-yes">&#x2705;</span>')
  $text = $text.Replace($charCross, '<span class="status-no">&#x274C;</span>')
    
  # Badges for tiers
  $text = $text.Replace('Authentic Tier', '<span class="badge-authentic">Authentic Tier</span>')
  $text = $text.Replace('Budget Smart (Tested OEM)', '<span class="badge-budget">Budget Smart (Tested OEM)</span>')
    
  return $text
}

$htmlBody = New-Object System.Text.StringBuilder

$inCodeBlock = $false
$codeBlockLang = ""
$codeBlockContent = New-Object System.Text.StringBuilder

$inTable = $false
$tableRows = New-Object System.Collections.Generic.List[string]

$inUl = $false
$inOl = $false

function Flush-Table {
  if ($tableRows.Count -eq 0) { return }
    
  [void]$htmlBody.AppendLine('<div class="table-container"><table>')
    
  $isHeader = $true
  for ($idx = 0; $idx -lt $tableRows.Count; $idx++) {
    $row = $tableRows[$idx].Trim()
    if ($row -match '^\|\s*:\s*[-]+') {
      # Divider row, skip
      continue
    }
        
    $cells = $row.Trim('|').Split('|')
        
    if ($isHeader) {
      [void]$htmlBody.AppendLine('  <thead><tr>')
      foreach ($c in $cells) {
        $val = Format-Inline ($c.Trim())
        [void]$htmlBody.AppendLine("    <th>$val</th>")
      }
      [void]$htmlBody.AppendLine('  </tr></thead><tbody>')
      $isHeader = $false
    }
    else {
      [void]$htmlBody.AppendLine('  <tr>')
      foreach ($c in $cells) {
        $rawC = $c.Trim()
        $val = Format-Inline $rawC
        [void]$htmlBody.AppendLine("    <td>$val</td>")
      }
      [void]$htmlBody.AppendLine('  </tr>')
    }
  }
    
  if (-not $isHeader) {
    [void]$htmlBody.AppendLine('</tbody>')
  }
  [void]$htmlBody.AppendLine('</table></div>')
  $tableRows.Clear()
}

function Close-Lists {
  if ($script:inUl) {
    [void]$htmlBody.AppendLine('</ul>')
    $script:inUl = $false
  }
  if ($script:inOl) {
    [void]$htmlBody.AppendLine('</ol>')
    $script:inOl = $false
  }
}

for ($i = 0; $i -lt $lines.Length; $i++) {
  $line = $lines[$i]
  $trimmed = $line.Trim()
    
  # Code block toggle
  if ($trimmed -match '^```(.*)$') {
    if ($inCodeBlock) {
      $inCodeBlock = $false
      $codeStr = $codeBlockContent.ToString()
      $encodedCode = [System.Net.WebUtility]::HtmlEncode($codeStr)
            
      # Check if flow diagram
      $isFlow = ($codeStr.IndexOf($charDash) -ge 0 -or $codeStr.IndexOf($charDown) -ge 0 -or $codeStr.IndexOf($charPipe) -ge 0 -or $codeStr -match '\[User |\[Customer |\[Courier |\[Runner |\[Pre-Order ')
      if ($isFlow) {
        [void]$htmlBody.AppendLine('<div class="flow-chart-wrapper">')
        [void]$htmlBody.AppendLine('  <div class="flow-header"><span class="flow-dot red"></span><span class="flow-dot yellow"></span><span class="flow-dot green"></span><span class="flow-title">Operational Workflow Diagram</span></div>')
        [void]$htmlBody.AppendLine("  <pre class=`"flow-diagram`"><code>$encodedCode</code></pre>")
        [void]$htmlBody.AppendLine('</div>')
      }
      else {
        [void]$htmlBody.AppendLine("<pre class=`"code-block`"><code>$encodedCode</code></pre>")
      }
      $null = $codeBlockContent.Clear()
    }
    else {
      Close-Lists
      if ($inTable) { Flush-Table; $inTable = $false }
      $inCodeBlock = $true
      $codeBlockLang = $matches[1]
    }
    continue
  }
    
  if ($inCodeBlock) {
    [void]$codeBlockContent.AppendLine($line)
    continue
  }
    
  # Table detection
  if ($trimmed -match '^\|.*\|$') {
    Close-Lists
    $inTable = $true
    $tableRows.Add($trimmed)
    continue
  }
  else {
    if ($inTable) {
      Flush-Table
      $inTable = $false
    }
  }
    
  # Empty line
  if ([string]::IsNullOrWhiteSpace($trimmed)) {
    Close-Lists
    continue
  }
    
  # Horizontal rule
  if ($trimmed -match '^---+$') {
    Close-Lists
    [void]$htmlBody.AppendLine('<hr class="section-divider" />')
    continue
  }
    
  # Headings
  if ($trimmed -match '^(#{1,6})\s+(.*)$') {
    Close-Lists
    $level = $matches[1].Length
    $hText = $matches[2]
    $formattedText = Format-Inline $hText
        
    $cleanId = [regex]::Replace($hText.ToLower(), '[^a-z0-9]+', '-').Trim('-')
        
    if ($level -eq 1) {
      [void]$htmlBody.AppendLine("<h1 id=`"$cleanId`" class=`"main-doc-title`">$formattedText</h1>")
    }
    elseif ($level -eq 2) {
      [void]$htmlBody.AppendLine("<div class=`"section-break`"></div>")
      [void]$htmlBody.AppendLine("<h2 id=`"$cleanId`" class=`"section-h2`"><span class=`"h2-accent`"></span>$formattedText</h2>")
    }
    elseif ($level -eq 3) {
      [void]$htmlBody.AppendLine("<h3 id=`"$cleanId`" class=`"section-h3`">$formattedText</h3>")
    }
    else {
      [void]$htmlBody.AppendLine("<h$level id=`"$cleanId`">$formattedText</h$level>")
    }
    continue
  }
    
  # Blockquotes / Callouts
  if ($trimmed -match '^>\s*(.*)$') {
    Close-Lists
    $bText = Format-Inline $matches[1]
    [void]$htmlBody.AppendLine("<div class=`"callout-box`"><p>$bText</p></div>")
    continue
  }
    
  # Unordered list
  if ($trimmed -match '^(\s*)[-*]\s+(.*)$') {
    if ($script:inOl) { Close-Lists }
    if (-not $script:inUl) {
      [void]$htmlBody.AppendLine('<ul class="styled-list">')
      $script:inUl = $true
    }
    $itemText = Format-Inline $matches[2]
    [void]$htmlBody.AppendLine("  <li>$itemText</li>")
    continue
  }
    
  # Ordered list
  if ($trimmed -match '^(\s*)\d+\.\s+(.*)$') {
    if ($script:inUl) { Close-Lists }
    if (-not $script:inOl) {
      [void]$htmlBody.AppendLine('<ol class="styled-list">')
      $script:inOl = $true
    }
    $itemText = Format-Inline $matches[2]
    [void]$htmlBody.AppendLine("  <li>$itemText</li>")
    continue
  }
    
  # Standard paragraph
  Close-Lists
  $pText = Format-Inline $trimmed
  [void]$htmlBody.AppendLine("<p>$pText</p>")
}

# Final flushes
Close-Lists
if ($inTable) { Flush-Table }

# Build final document with executive presentation styling
$fullHtml = @"
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Product Requirements Document (PRD) — NCAMart</title>
<style>
  @page {
    size: A4;
    margin: 16mm 14mm 16mm 14mm;
  }

  :root {
    --primary: #0F172A;
    --primary-light: #1E293B;
    --accent: #2563EB;
    --accent-light: #EFF6FF;
    --authentic-gold: #B45309;
    --authentic-bg: #FEF3C7;
    --budget-teal: #0D9488;
    --budget-bg: #CCFBF1;
    --text-main: #1E293B;
    --text-muted: #64748B;
    --border-color: #E2E8F0;
    --card-bg: #F8FAFC;
    --success: #15803D;
    --danger: #DC2626;
  }

  * {
    box-sizing: border-box;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    color: var(--text-main);
    background: #FFFFFF;
    line-height: 1.55;
    font-size: 9pt;
    margin: 0;
    padding: 0;
  }

  /* Cover Page */
  .cover-page {
    page-break-after: always;
    min-height: 92vh;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 24px 10px;
    border-bottom: 2px solid var(--border-color);
  }

  .cover-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px solid #2563EB;
    padding-bottom: 16px;
  }

  .logo-block {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .logo-badge {
    background: #0F172A;
    color: #FFFFFF;
    font-weight: 800;
    font-size: 16pt;
    padding: 8px 16px;
    border-radius: 8px;
    letter-spacing: 1px;
    border-left: 5px solid #2563EB;
  }

  .logo-text h1 {
    margin: 0;
    font-size: 14pt;
    font-weight: 800;
    color: var(--primary);
    line-height: 1.1;
  }

  .logo-text p {
    margin: 2px 0 0;
    font-size: 8pt;
    color: var(--text-muted);
    font-weight: 500;
    letter-spacing: 0.5px;
  }

  .confidential-tag {
    background: #FEE2E2;
    color: #991B1B;
    font-size: 8pt;
    font-weight: 700;
    padding: 6px 12px;
    border-radius: 20px;
    letter-spacing: 0.5px;
    border: 1px solid #FECACA;
  }

  .cover-hero {
    margin: 30px 0 20px;
  }

  .doc-category {
    color: var(--accent);
    font-size: 10pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    margin-bottom: 8px;
  }

  .cover-title {
    font-size: 24pt;
    font-weight: 800;
    color: var(--primary);
    line-height: 1.2;
    margin: 0 0 12px;
  }

  .cover-subtitle {
    font-size: 11.5pt;
    color: var(--text-muted);
    line-height: 1.5;
    max-width: 680px;
    margin-bottom: 20px;
  }

  .cover-meta-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 16px 20px;
    max-width: 720px;
  }

  .meta-item {
    font-size: 8.5pt;
  }

  .meta-label {
    font-size: 7pt;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted);
    font-weight: 600;
    margin-bottom: 2px;
  }

  .meta-value {
    color: var(--primary);
    font-weight: 700;
    font-size: 9pt;
  }

  .executive-note {
    background: #EFF6FF;
    border-left: 4px solid #2563EB;
    border-radius: 0 8px 8px 0;
    padding: 14px 18px;
    margin-top: 18px;
    max-width: 720px;
  }

  .executive-note h4 {
    margin: 0 0 4px;
    color: #1E40AF;
    font-size: 9pt;
    font-weight: 700;
  }

  .executive-note p {
    margin: 0;
    font-size: 8.5pt;
    color: #1E3A8A;
    line-height: 1.45;
  }

  .cover-footer {
    border-top: 1px solid var(--border-color);
    padding-top: 12px;
    display: flex;
    justify-content: space-between;
    font-size: 7.5pt;
    color: var(--text-muted);
  }

  /* Table of Contents Box */
  .toc-card {
    page-break-after: always;
    padding: 24px 10px;
  }

  .toc-card h2 {
    font-size: 16pt;
    font-weight: 800;
    color: var(--primary);
    border-bottom: 2px solid #2563EB;
    padding-bottom: 8px;
    margin-top: 0;
    margin-bottom: 16px;
  }

  .toc-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px 24px;
  }

  .toc-item {
    font-size: 8.5pt;
    padding: 6px 10px;
    background: #F8FAFC;
    border: 1px solid #E2E8F0;
    border-radius: 6px;
  }

  .toc-item-title {
    font-weight: 700;
    color: #0F172A;
  }

  .toc-item-desc {
    font-size: 7.5pt;
    color: #64748B;
    margin-top: 2px;
  }

  /* Content Styling */
  .document-body {
    padding-top: 10px;
  }

  h1.main-doc-title {
    display: none;
  }

  .section-break {
    page-break-before: always;
    height: 1px;
    margin-top: 10px;
  }

  h2.section-h2 {
    font-size: 13.5pt;
    font-weight: 800;
    color: var(--primary);
    border-bottom: 2px solid #E2E8F0;
    padding-bottom: 6px;
    margin-top: 20px;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    page-break-after: avoid;
  }

  .h2-accent {
    width: 5px;
    height: 17px;
    background: var(--accent);
    border-radius: 2px;
    display: inline-block;
  }

  h3.section-h3 {
    font-size: 10.5pt;
    font-weight: 700;
    color: var(--primary-light);
    margin-top: 14px;
    margin-bottom: 6px;
    page-break-after: avoid;
  }

  p {
    margin: 0 0 8px;
    color: #334155;
    text-align: justify;
  }

  strong {
    color: var(--primary);
  }

  /* Tables */
  .table-container {
    margin: 10px 0 14px;
    width: 100%;
    overflow: hidden;
    page-break-inside: avoid;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 7.8pt;
    background: #FFFFFF;
    border: 1px solid #CBD5E1;
    border-radius: 6px;
  }

  thead {
    background: #0F172A;
    color: #FFFFFF;
  }

  th {
    padding: 6px 8px;
    font-weight: 600;
    text-align: left;
    font-size: 7.8pt;
    letter-spacing: 0.3px;
    border-right: 1px solid #334155;
    color: #FFFFFF;
  }

  th:last-child {
    border-right: none;
  }

  td {
    padding: 5px 8px;
    border-bottom: 1px solid #E2E8F0;
    border-right: 1px solid #E2E8F0;
    vertical-align: top;
    color: #334155;
    line-height: 1.35;
  }

  td:last-child {
    border-right: none;
  }

  tbody tr:nth-child(even) {
    background-color: #F8FAFC;
  }

  /* Badges */
  .badge-authentic {
    display: inline-block;
    background: #EFF6FF;
    color: #1D4ED8;
    border: 1px solid #BFDBFE;
    padding: 1px 5px;
    border-radius: 4px;
    font-weight: 600;
    font-size: 7pt;
  }

  .badge-budget {
    display: inline-block;
    background: #F0FDF4;
    color: #047857;
    border: 1px solid #A7F3D0;
    padding: 1px 5px;
    border-radius: 4px;
    font-weight: 600;
    font-size: 7pt;
  }

  .status-yes {
    color: #16A34A;
    font-size: 9pt;
    margin-right: 2px;
  }

  .status-no {
    color: #DC2626;
    font-size: 9pt;
    margin-right: 2px;
  }

  /* Lists */
  ul.styled-list, ol.styled-list {
    margin: 4px 0 10px 16px;
    padding: 0;
  }

  ul.styled-list li, ol.styled-list li {
    margin-bottom: 3px;
    color: #334155;
    line-height: 1.4;
  }

  /* Callouts */
  .callout-box {
    background: #F8FAFC;
    border-left: 3.5px solid #64748B;
    padding: 8px 12px;
    margin: 8px 0;
    border-radius: 0 6px 6px 0;
    font-size: 8pt;
    color: #475569;
  }

  .callout-box p {
    margin: 0;
  }

  /* Flow Diagrams */
  .flow-chart-wrapper {
    margin: 10px 0 14px;
    background: #0B1120;
    border-radius: 6px;
    overflow: hidden;
    border: 1px solid #1E293B;
    page-break-inside: avoid;
  }

  .flow-header {
    background: #1E293B;
    padding: 4px 8px;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .flow-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    display: inline-block;
  }

  .flow-dot.red { background: #EF4444; }
  .flow-dot.yellow { background: #F59E0B; }
  .flow-dot.green { background: #10B981; }

  .flow-title {
    margin-left: 6px;
    font-size: 6.8pt;
    font-weight: 600;
    color: #94A3B8;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }

  pre.flow-diagram {
    margin: 0;
    padding: 8px 10px;
    font-family: 'Consolas', 'Courier New', monospace;
    font-size: 6.8pt;
    line-height: 1.3;
    color: #38BDF8;
    background: #0B1120;
    overflow-x: auto;
    white-space: pre;
  }

  pre.code-block {
    background: #F1F5F9;
    border: 1px solid #E2E8F0;
    border-radius: 5px;
    padding: 6px 8px;
    font-family: 'Consolas', 'Courier New', monospace;
    font-size: 7pt;
    color: #0F172A;
    overflow-x: auto;
    margin: 6px 0;
  }

  code {
    font-family: 'Consolas', 'Courier New', monospace;
    background: #F1F5F9;
    color: #0F172A;
    padding: 1px 3px;
    border-radius: 3px;
    font-size: 7.8pt;
  }

  hr.section-divider {
    border: none;
    height: 1px;
    background: #E2E8F0;
    margin: 14px 0;
  }

  a {
    color: #2563EB;
    text-decoration: none;
  }

  @media print {
    body {
      padding: 0;
    }
    .flow-chart-wrapper, .table-container {
      page-break-inside: avoid;
    }
    h2, h3 {
      page-break-after: avoid;
    }
  }
</style>
</head>
<body>

<!-- EXECUTIVE COVER PAGE -->
<div class="cover-page">
  <div class="cover-header">
    <div class="logo-block">
      <div class="logo-badge">NCAMART</div>
      <div class="logo-text">
        <h1>NCAMART PRODUCT BLUEPRINT</h1>
        <p>NAWABPUR COMPLEX ACCESSORIES • DHAKA, BANGLADESH</p>
      </div>
    </div>
    <div class="confidential-tag">CONFIDENTIAL & PROPRIETARY</div>
  </div>

  <div class="cover-hero">
    <div class="doc-category">Formal Engineering & Business Specifications</div>
    <div class="cover-title">Product Requirements Document (PRD)</div>
    <div class="cover-subtitle">
      Comprehensive architectural, operational, marketing, and legal requirements for launching NCAMart — The trusted e-commerce and local drop-and-pack tech platform in Nawabpur.
    </div>

    <div class="cover-meta-grid">
      <div class="meta-item">
        <div class="meta-label">Document Version</div>
        <div class="meta-value">Version 1.4 (Final Approved & Architecture-Aligned)</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Approval Status</div>
        <div class="meta-value">Approved for Technical & Marketing Execution</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Prepared For</div>
        <div class="meta-value">Executive Leadership & Engineering Team</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Primary Author</div>
        <div class="meta-value">NCAMart Product & Engineering Team</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Release Date</div>
        <div class="meta-value">October 2026</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Official Domain</div>
        <div class="meta-value">ncamart.com</div>
      </div>
    </div>

    <div class="executive-note">
      <h4>Executive Briefing for Leadership & Engineering</h4>
      <p>
        This document defines NCAMart's strategic positioning to dominate Nawabpur, Sundarban Square, and Stadium Market electronics retail. Key focal points include: the <strong>Two-Tier Trust Engine</strong> (Authentic vs. Tested OEM Budget), <strong>Physical VOID Security Seals</strong> with online serial lookups, <strong>Pre-Order Import Engine</strong> with progressive 10%–20% deposits, <strong>Double-Entry Finance Ledger</strong>, <strong>Courier COD & Gateway Settlement Reconciliation</strong>, and <strong>Drop-and-Pack Local Fulfillment</strong>.
      </p>
    </div>
  </div>

  <div class="cover-footer">
    <div><strong>Confidentiality:</strong> Strictly for internal management review. Unauthorized copying or redistribution is prohibited.</div>
    <div><strong>Doc ID:</strong> PRD-NCA-2026-V1.4</div>
  </div>
</div>

<!-- EXECUTIVE TABLE OF CONTENTS -->
<div class="toc-card">
  <h2>Executive Table of Contents</h2>
  <div class="toc-grid">
    <div class="toc-item">
      <div class="toc-item-title">1. Project Overview & Objectives</div>
      <div class="toc-item-desc">Executive summary, problem statement, core business objectives & 13 Phase-1 success metrics.</div>
    </div>
    <div class="toc-item">
      <div class="toc-item-title">2. Target Users & Persona Matrix</div>
      <div class="toc-item-desc">Analysis of 8 distinct user personas from Brand Purists to Finance Officers.</div>
    </div>
    <div class="toc-item">
      <div class="toc-item-title">3. Core Features & System Architecture</div>
      <div class="toc-item-desc">Two-tier catalog, VOID seals, Pre-Order deposits, SSLCommerz, Inventory model, Finance ledger & RBAC.</div>
    </div>
    <div class="toc-item">
      <div class="toc-item-title">4. End-to-End Operational Flows</div>
      <div class="toc-item-desc">13 visual architecture workflows covering checkout, sourcing, RTO, RMA, counter pickup & ledger.</div>
    </div>
    <div class="toc-item">
      <div class="toc-item-title">5. Out of Scope (Phase 1 / MVP)</div>
      <div class="toc-item-desc">Explicit boundaries preventing scope creep (marketplaces, dropshipping, native apps).</div>
    </div>
    <div class="toc-item">
      <div class="toc-item-title">6. Non-Functional & Security Requirements</div>
      <div class="toc-item-desc">Performance SLAs, Crockford Base32 entropy, Turnstile, runner PII masking & BTRC compliance.</div>
    </div>
    <div class="toc-item">
      <div class="toc-item-title">7. Data Model Entities</div>
      <div class="toc-item-desc">High-level relational schema spanning Products, Inventory, Orders, Pre-Orders, Ledger & Seals.</div>
    </div>
    <div class="toc-item">
      <div class="toc-item-title">8. Legal & Regulatory Compliance</div>
      <div class="toc-item-desc">Trademarks Act 2009, Digital Commerce Guidelines, BTRC approvals & NBR Mushak 6.3.</div>
    </div>
    <div class="toc-item">
      <div class="toc-item-title">9. Marketing & Sales Channels</div>
      <div class="toc-item-desc">Facebook/IG shop sync, WhatsApp automation, SEO comparison content & Showroom QR.</div>
    </div>
    <div class="toc-item">
      <div class="toc-item-title">10. Risks, Mitigations & Exceptions</div>
      <div class="toc-item-desc">Matrix addressing spot price inflation, customs delays, seal tampering & courier remittance.</div>
    </div>
    <div class="toc-item">
      <div class="toc-item-title">11. Release Roadmap & Milestones</div>
      <div class="toc-item-desc">Phased timeline from Foundation (Phase 0) to MVP Launch (Phase 1) and Scale (Phase 2).</div>
    </div>
    <div class="toc-item">
      <div class="toc-item-title">12. Resolved Architectural Decisions</div>
      <div class="toc-item-desc">Final confirmed specifications on deposits, payment gateways, branding & tech stack.</div>
    </div>
    <div class="toc-item">
      <div class="toc-item-title">13. Superseded Values & Conflicts Resolved</div>
      <div class="toc-item-desc">Comprehensive priority mapping resolving earlier ambiguities against requirement-validation.</div>
    </div>
  </div>
</div>

<!-- DOCUMENT BODY CONTENT -->
<div class="document-body">
$($htmlBody.ToString())
</div>

</body>
</html>
"@

# Save HTML with UTF-8 encoding
[System.IO.File]::WriteAllText($htmlPath, $fullHtml, [System.Text.Encoding]::UTF8)
Write-Host "Generated HTML at: $htmlPath"

# Print to PDF using Edge Headless
$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) {
  $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

$fileUri = "file:///" + ($htmlPath.Replace('\', '/'))
Write-Host "Converting HTML to PDF with Edge..."

$proc = Start-Process -FilePath $edgePath -ArgumentList "--headless=new", "--disable-gpu", "--no-pdf-header-footer", "--print-to-pdf=`"$pdfPath`"", "`"$fileUri`"" -Wait -PassThru

if (Test-Path $pdfPath) {
  $size = (Get-Item $pdfPath).Length
  Write-Host "SUCCESS: PDF generated at $pdfPath (Size: $size bytes)"
}
else {
  Write-Error "Failed to generate PDF."
}

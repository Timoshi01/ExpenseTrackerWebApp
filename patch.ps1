$path = "basta.html"
$content = [System.IO.File]::ReadAllText($path)

$imgs = @(
    "picture/064bc471-d7aa-489d-b3cb-2c5db0ced090.jpg",
    "picture/a70745af-de28-4897-a83b-971fd377818e.jpg",
    "picture/e41aab5d-da4f-46a4-b86b-21ed3871b1eb.jpg",
    "picture/522aadae-a377-4e7b-bdae-b285d2e4af92.jpg",
    "picture/3a3f66a2-1fb7-484b-a9b7-90c355606c78.jpg",
    "picture/8e88884d-ea3e-4f5f-ab10-8e29243edc63.jpg"
)

$captions = @(
    "Home dashboard: total spent, monthly budget progress, budget left card",
    "Settings panel: sign in with Google, dark mode, updates & data management",
    "Budget view: set monthly/weekly goal, reset button & Budget vs Actual chart",
    "Add expense: custom category “Plete bus”, amount ₱80, date auto.",
    "History: heatmap (last 30 days), filter control & save file button",
    "Calendar: pick a date, see day total & expenses for that day."
)

$regex = [regex]'(?s)<div class="screenshot-grid">.*?</div>\s*</div>'
$matches = $regex.Matches($content)

$offset = 0
for ($i=0; $i -lt $matches.Count; $i++) {
    if ($i -lt $imgs.Count) {
        $img = $imgs[$i]
        $cap = $captions[$i]
        $newText = @"
        <div class="screenshot-grid">
          <div class="screenshot-card">
            <img src="$img" alt="Guide $i" style="max-width: 100%; height: auto; border-radius: 20px; display: block; margin: 0 auto;">
            <div class="img-caption">$cap</div>
          </div>
        </div>
      </div>
"@
        $content = $content.Remove($matches[$i].Index + $offset, $matches[$i].Length).Insert($matches[$i].Index + $offset, $newText)
        $offset += $newText.Length - $matches[$i].Length
    }
}

[System.IO.File]::WriteAllText($path, $content)

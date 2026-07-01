"""Insert URL ?q= param reader into SmartDiscovery.tsx after the focus useEffect."""
with open('client/src/pages/SmartDiscovery.tsx', 'r') as f:
    content = f.read()

# The blank line after the focus useEffect is the insertion point
old = "  }, []);\n\n  // Scroll to bottom when conversation updates"

new = """  }, []);
  // Auto-submit if ?q= URL param is present (used by MarketCommandCenter and other entry points)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlQuery = params.get("q");
    if (urlQuery && urlQuery.trim()) {
      // Remove the param from the URL without a page reload
      window.history.replaceState({}, "", window.location.pathname);
      // Small delay to let the page fully mount before submitting
      setTimeout(() => {
        void handleSubmit(urlQuery.trim());
      }, 200);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll to bottom when conversation updates"""

# Count occurrences of the old pattern to avoid ambiguity
count = content.count(old)
print(f"Found {count} occurrence(s) of target text")

if count == 1:
    new_content = content.replace(old, new, 1)
    with open('client/src/pages/SmartDiscovery.tsx', 'w') as f:
        f.write(new_content)
    print("SUCCESS: URL param reader inserted")
elif count == 0:
    print("ERROR: target text not found")
    # Debug: find all }, []); patterns
    lines = content.split('\n')
    for i, line in enumerate(lines):
        if '}, []);' in line:
            print(f"  Line {i+1}: {line}")
else:
    print(f"ERROR: found {count} occurrences, need exactly 1")

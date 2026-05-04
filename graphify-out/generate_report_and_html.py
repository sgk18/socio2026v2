import json
from pathlib import Path
from graphify.build import build_from_json
from graphify.cluster import cluster
from graphify.analyze import god_nodes, surprising_connections
from graphify.report import generate
from graphify.export import to_html

# Paths
extract_p = Path('graphify-out/.graphify_extract.json')
analysis_p = Path('graphify-out/.graphify_analysis.json')
client_detect_p = Path('graphify-out/.graphify_detect_client.json')
server_detect_p = Path('graphify-out/.graphify_detect_server.json')
merged_detect_p = Path('graphify-out/.graphify_detect_merged.json')
report_p = Path('graphify-out/GRAPH_REPORT.md')
html_p = Path('graphify-out/graph.html')

# Load extraction and analysis
extraction = json.loads(extract_p.read_text())
analysis = json.loads(analysis_p.read_text())

# Build detection result by merging client+server detects if present
if client_detect_p.exists() and server_detect_p.exists():
    cd = json.loads(client_detect_p.read_text())
    sd = json.loads(server_detect_p.read_text())
    detect = {
        'total_files': cd.get('total_files', 0) + sd.get('total_files', 0),
        'total_words': cd.get('total_words', 0) + sd.get('total_words', 0),
        'files': {}
    }
    for k in set(cd.get('files', {}).keys()) | set(sd.get('files', {}).keys()):
        detect['files'][k] = cd.get('files', {}).get(k, []) + sd.get('files', {}).get(k, [])
    merged_detect_p.write_text(json.dumps(detect, indent=2))
else:
    detect = {'total_files': len(extraction.get('nodes', [])), 'total_words': 0, 'files': {}}
    merged_detect_p.write_text(json.dumps(detect, indent=2))

# Build graph and analysis
G = build_from_json(extraction)
communities = {int(k): v for k, v in json.loads(Path('graphify-out/.graphify_analysis.json').read_text()).get('communities', {}).items()}
gods = god_nodes(G)
surprises = surprising_connections(G, communities)

# Generate report
report = generate(G, communities, {}, detect, gods, surprises, extraction, token_cost=0, root=Path('.'))
report_p.write_text(report)
print('GRAPH_REPORT.md written')

# Generate HTML visualization
try:
    to_html(G, communities, str(html_p))
    print('graph.html written')
except Exception as e:
    print('Visualization skipped:', e)

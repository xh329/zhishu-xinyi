import http.server, socketserver, os
class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
os.chdir(r'D:/vibe coding/课程任务')
socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(('127.0.0.1', 8137), NoCache) as httpd:
    httpd.serve_forever()

const currentYear = new Date().getFullYear();
export const html = (serverName: string) => `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${serverName} Server - Enterprise Ready</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    </head>
    <body>
      <div class="container">
        <!-- Animated background -->
        <div class="bg-animation">
          <div class="particle"></div>
          <div class="particle"></div>
          <div class="particle"></div>
          <div class="particle"></div>
          <div class="particle"></div>
          <div class="particle"></div>
        </div>
        
        <!-- Main content -->
        <div class="content">
          <div class="status-badge">
            <div class="status-dot"></div>
            <span>ONLINE</span>
          </div>
          
          <div class="logo-section">
            <div class="server-icon">
              <div class="server-stack">
                <div class="server-layer"></div>
                <div class="server-layer"></div>
                <div class="server-layer active"></div>
              </div>
            </div>
            <h1 class="main-title">${serverName}</h1>
            <div class="subtitle">Enterprise Server Infrastructure</div>
          </div>
          
          
          
          <div class="message-box">
            <div class="success-icon">✓</div>
            <h2>System Status: Operational</h2>
            <p>All services are running optimally. Ready to handle enterprise-level workloads with maximum performance and reliability.</p>
          </div>
          
          <div class="tech-stack">
            <div class="tech-item">Node.js</div>
            <div class="tech-item">Express</div>
            <div class="tech-item">TypeScript</div>
            <div class="tech-item">Docker</div>
            <div class="tech-item">Redis</div>
            <div class="tech-item">MongoDB</div>
          </div>
          
          <footer class="footer">
            <div class="footer-content">
              <div>© ${currentYear} ${serverName}. All rights reserved.</div>
              <div class="footer-links">
                <span>Enterprise Ready</span>
                <span>•</span>
                <span>24/7 Monitoring</span>
                <span>•</span>
                <span>Scalable Architecture</span>
              </div>
            </div>
          </footer>
        </div>
      </div>
      
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          height: 100vh;
          overflow: hidden;
          background: #0a0a0a;
        }
        
        .container {
          position: relative;
          width: 100%;
          height: 100vh;
          background: linear-gradient(135deg, 
            #667eea 0%, 
            #764ba2 25%, 
            #f093fb 50%, 
            #f5576c 75%, 
            #4facfe 100%);
          background-size: 400% 400%;
          animation: gradientShift 15s ease infinite;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        
        .bg-animation {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          overflow: hidden;
          z-index: 1;
        }
        
        .particle {
          position: absolute;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 50%;
          animation: float 20s infinite linear;
        }
        
        .particle:nth-child(1) {
          width: 80px;
          height: 80px;
          top: 20%;
          left: 10%;
          animation-delay: 0s;
          animation-duration: 25s;
        }
        
        .particle:nth-child(2) {
          width: 120px;
          height: 120px;
          top: 60%;
          left: 80%;
          animation-delay: 5s;
          animation-duration: 30s;
        }
        
        .particle:nth-child(3) {
          width: 60px;
          height: 60px;
          top: 80%;
          left: 20%;
          animation-delay: 10s;
          animation-duration: 35s;
        }
        
        .particle:nth-child(4) {
          width: 100px;
          height: 100px;
          top: 10%;
          left: 70%;
          animation-delay: 15s;
          animation-duration: 28s;
        }
        
        .particle:nth-child(5) {
          width: 40px;
          height: 40px;
          top: 40%;
          left: 5%;
          animation-delay: 8s;
          animation-duration: 22s;
        }
        
        .particle:nth-child(6) {
          width: 90px;
          height: 90px;
          top: 30%;
          left: 90%;
          animation-delay: 12s;
          animation-duration: 32s;
        }
        
        @keyframes float {
          0% { 
            transform: translateY(100vh) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            transform: translateY(-100px) rotate(360deg);
            opacity: 0;
          }
        }
        
        .content {
          position: relative;
          z-index: 2;
          text-align: center;
          color: white;
          max-width: 800px;
          padding: 40px;
          backdrop-filter: blur(20px);
          background: rgba(255, 255, 255, 0.1);
          border-radius: 24px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          box-shadow: 0 25px 50px rgba(0, 0, 0, 0.3);
          animation: slideUp 1s ease-out;
        }
        
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(50px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(34, 197, 94, 0.2);
          border: 1px solid rgba(34, 197, 94, 0.4);
          padding: 8px 16px;
          border-radius: 50px;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 1px;
          margin-bottom: 30px;
          animation: pulse 2s infinite;
        }
        
        .status-dot {
          width: 8px;
          height: 8px;
          background: #22c55e;
          border-radius: 50%;
          animation: blink 1.5s infinite;
        }
        
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0.3; }
        }
        
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); }
          70% { box-shadow: 0 0 0 10px rgba(34, 197, 94, 0); }
          100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
        }
        
        .logo-section {
          margin-bottom: 40px;
        }
        
        .server-icon {
          margin: 0 auto 20px;
          width: 80px;
          height: 80px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .server-stack {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        
        .server-layer {
          width: 60px;
          height: 12px;
          background: rgba(255, 255, 255, 0.3);
          border-radius: 6px;
          border: 1px solid rgba(255, 255, 255, 0.5);
          position: relative;
          transition: all 0.3s ease;
        }
        
        .server-layer.active {
          background: rgba(34, 197, 94, 0.5);
          border-color: #22c55e;
          box-shadow: 0 0 15px rgba(34, 197, 94, 0.4);
        }
        
        .server-layer::before {
          content: '';
          position: absolute;
          left: 4px;
          top: 50%;
          transform: translateY(-50%);
          width: 4px;
          height: 4px;
          background: currentColor;
          border-radius: 50%;
        }
        
        .main-title {
          font-size: 4rem;
          font-weight: 800;
          margin-bottom: 10px;
          background: linear-gradient(45deg, #fff, #f0f0f0, #fff);
          background-size: 200% 200%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmer 3s ease-in-out infinite;
          text-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
        }
        
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        
        .subtitle {
          font-size: 1.2rem;
          font-weight: 300;
          opacity: 0.9;
          letter-spacing: 2px;
          text-transform: uppercase;
        }
        
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          margin: 40px 0;
        }
        
        .stat-card {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 16px;
          padding: 20px;
          backdrop-filter: blur(10px);
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        
        .stat-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 15px 35px rgba(0, 0, 0, 0.2);
        }
        
        .stat-icon {
          font-size: 2rem;
          margin-bottom: 10px;
        }
        
        .stat-value {
          font-size: 2.5rem;
          font-weight: 700;
          margin-bottom: 5px;
        }
        
        .stat-label {
          font-size: 0.9rem;
          opacity: 0.8;
          font-weight: 500;
        }
        
        .message-box {
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.3);
          border-radius: 16px;
          padding: 30px;
          margin: 40px 0;
          position: relative;
        }
        
        .success-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 50px;
          height: 50px;
          background: #22c55e;
          border-radius: 50%;
          font-size: 24px;
          font-weight: bold;
          margin-bottom: 15px;
        }
        
        .message-box h2 {
          font-size: 1.5rem;
          font-weight: 600;
          margin-bottom: 10px;
        }
        
        .message-box p {
          font-size: 1rem;
          opacity: 0.9;
          line-height: 1.6;
        }
        
        .tech-stack {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 12px;
          margin: 30px 0;
        }
        
        .tech-item {
          background: rgba(255, 255, 255, 0.15);
          border: 1px solid rgba(255, 255, 255, 0.3);
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 0.85rem;
          font-weight: 500;
          backdrop-filter: blur(10px);
          transition: all 0.3s ease;
        }
        
        .tech-item:hover {
          background: rgba(255, 255, 255, 0.25);
          transform: translateY(-2px);
        }
        
        .footer {
          margin-top: 40px;
          padding-top: 30px;
          border-top: 1px solid rgba(255, 255, 255, 0.2);
        }
        
        .footer-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          font-size: 0.9rem;
          opacity: 0.8;
        }
        
        .footer-links {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 0.8rem;
        }
        
        @media (max-width: 768px) {
          .content {
            margin: 20px;
            padding: 30px 20px;
          }
          
          .main-title {
            font-size: 2.5rem;
          }
          
          .stats-grid {
            grid-template-columns: 1fr;
            gap: 15px;
          }
          
          .footer-links {
            flex-direction: column;
            gap: 5px;
          }
          
          .tech-stack {
            gap: 8px;
          }
        }
      </style>
      
      <script>
        // Animate counters
        function animateCounters() {
          const counters = document.querySelectorAll('.stat-value');
          counters.forEach(counter => {
            const target = parseFloat(counter.dataset.target);
            const increment = target / 100;
            let current = 0;
            
            const updateCounter = () => {
              if (current < target) {
                current += increment;
                if (target % 1 === 0) {
                  counter.textContent = Math.ceil(current);
                } else {
                  counter.textContent = current.toFixed(1);
                }
                setTimeout(updateCounter, 20);
              } else {
                if (target % 1 === 0) {
                  counter.textContent = target;
                } else {
                  counter.textContent = target.toFixed(1);
                }
              }
            };
            
            setTimeout(updateCounter, 500);
          });
        }
        
        // Start animations when page loads
        document.addEventListener('DOMContentLoaded', () => {
          animateCounters();
        });
        
        // Add floating animation to server layers
        const serverLayers = document.querySelectorAll('.server-layer');
        serverLayers.forEach((layer, index) => {
          layer.style.animationDelay = \`\${index * 0.2}s\`;
          layer.style.animation = 'float 3s ease-in-out infinite';
        });
      </script>
    </body>
    </html>
  `
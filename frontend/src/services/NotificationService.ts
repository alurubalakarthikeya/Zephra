// Notification Service for Backend Switch
export type BackendMode = 'api' | 'mock';

class NotificationService {
  private static instance: NotificationService;

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  public async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      return 'denied';
    }

    if (Notification.permission === 'granted') {
      return 'granted';
    }

    if (Notification.permission !== 'denied') {
      return await Notification.requestPermission();
    }

    return Notification.permission;
  }

  public async showBackendSwitchNotification(mode: BackendMode): Promise<void> {
    const title = 'Toggle Successful';
    const body = '';

    // Always show toast notification for immediate visual feedback
    this.showToastNotification(title, body, mode);
    
    // Also try browser notification if permission is granted
    const permission = await this.requestPermission();
    
    if (permission === 'granted') {
      try {
        const notification = new Notification('Zephra', {
          body: title,
          icon: '/icon.png',
          tag: 'backend-switch',
          requireInteraction: false
        });

        // Auto close after 1.5 seconds
        setTimeout(() => notification.close(), 1500);
        
        notification.onclick = () => {
          window.focus();
          notification.close();
        };

        console.log('📱 Browser notification sent');
      } catch (error) {
        console.warn('Browser notification failed:', error);
      }
    }
  }

  private showToastNotification(title: string, body: string, mode: BackendMode): void {
    // Remove any existing toast
    const existing = document.querySelector('.backend-switch-toast');
    if (existing) {
      existing.remove();
    }

    // Create toast element
    const toast = document.createElement('div');
    toast.className = 'backend-switch-toast';
    toast.innerHTML = `
      <div class="toast-content">
        <div class="toast-icon">✅</div>
        <div class="toast-text">
          <div class="toast-title">${title}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `;

    // Add CSS if not present
    this.addToastStyles();

    // Add to DOM
    document.body.appendChild(toast);

    // Auto remove after 1.5 seconds
    setTimeout(() => {
      if (toast.parentElement) {
        toast.classList.add('removing');
        setTimeout(() => {
          if (toast.parentElement) {
            toast.remove();
          }
        }, 300);
      }
    }, 1500);

    // Click to dismiss
    toast.addEventListener('click', (e) => {
      if (e.target !== toast.querySelector('.toast-close')) {
        toast.classList.add('removing');
        setTimeout(() => {
          if (toast.parentElement) {
            toast.remove();
          }
        }, 300);
      }
    });

    console.log('🍞 Toast notification shown');
  }

  private addToastStyles(): void {
    if (document.querySelector('#backend-toast-styles')) return;

    const style = document.createElement('style');
    style.id = 'backend-toast-styles';
    style.textContent = `
      .backend-switch-toast {
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #4CAF50, #45a049);
        color: white;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        min-width: 320px;
        max-width: 400px;
        animation: slideInRight 0.4s ease-out;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      }

      .toast-content {
        display: flex;
        align-items: center;
        padding: 16px;
        gap: 12px;
      }

      .toast-icon {
        font-size: 24px;
        flex-shrink: 0;
      }

      .toast-text {
        flex: 1;
      }

      .toast-title {
        font-weight: 600;
        font-size: 14px;
        margin-bottom: 4px;
      }

      .toast-body {
        font-size: 13px;
        opacity: 0.9;
        line-height: 1.4;
      }

      .toast-close {
        background: none;
        border: none;
        color: white;
        font-size: 20px;
        cursor: pointer;
        padding: 4px;
        line-height: 1;
        opacity: 0.8;
        transition: opacity 0.2s;
        flex-shrink: 0;
      }

      .toast-close:hover {
        opacity: 1;
      }

      @keyframes slideInRight {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }

      .backend-switch-toast.removing {
        animation: slideOutRight 0.3s ease-out forwards;
      }

      @keyframes slideOutRight {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(100%);
          opacity: 0;
        }
      }

      @media (max-width: 768px) {
        .backend-switch-toast {
          top: 10px;
          right: 10px;
          left: 10px;
          min-width: auto;
          max-width: none;
        }
      }
    `;

    document.head.appendChild(style);
  }
}

export default NotificationService;
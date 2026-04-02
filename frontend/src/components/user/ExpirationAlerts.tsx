import { useState, useEffect } from 'react';
import { Bell, Calendar, AlertTriangle, Clock, CheckCircle } from 'lucide-react';
import { Card, CardHeader, CardBody, Button, Badge } from '../common';

interface ExpiringCredential {
  id: string;
  type: string;
  issuer: string;
  expiresAt: Date;
  daysRemaining: number;
  status: 'expired' | 'expiring-soon' | 'valid';
}

export function ExpirationAlerts() {
  const [alerts, setAlerts] = useState<ExpiringCredential[]>([]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  useEffect(() => {
    // Mock data - in real app would check localStorage/credentials
    const mockAlerts: ExpiringCredential[] = [
      {
        id: '1',
        type: 'Vaccination Record',
        issuer: 'City General Hospital',
        expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days
        daysRemaining: 5,
        status: 'expiring-soon',
      },
      {
        id: '2',
        type: 'Medical Clearance',
        issuer: 'Sports Medicine Center',
        expiresAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        daysRemaining: -2,
        status: 'expired',
      },
      {
        id: '3',
        type: 'Free Healthcare Eligibility',
        issuer: 'Public Health Dept',
        expiresAt: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000), // 45 days
        daysRemaining: 45,
        status: 'valid',
      },
    ];
    setAlerts(mockAlerts);
  }, []);

  const requestNotifications = () => {
    if ('Notification' in window) {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          setNotificationsEnabled(true);
        }
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'expired': return <AlertTriangle className="w-5 h-5 text-red-600" />;
      case 'expiring-soon': return <Clock className="w-5 h-5 text-amber-600" />;
      case 'valid': return <CheckCircle className="w-5 h-5 text-emerald-600" />;
      default: return null;
    }
  };

  const getStatusBadge = (status: string, days: number) => {
    switch (status) {
      case 'expired': 
        return <Badge variant="error">Expired {Math.abs(days)} days ago</Badge>;
      case 'expiring-soon': 
        return <Badge variant="warning">Expires in {days} days</Badge>;
      case 'valid': 
        return <Badge variant="success">Valid ({days} days left)</Badge>;
      default: 
        return null;
    }
  };

  const urgentAlerts = alerts.filter(a => a.status === 'expired' || a.status === 'expiring-soon');

  return (
    <Card>
      <CardHeader 
        title="Expiration Alerts"
        subtitle="Monitor your credential expiration dates"
        icon={Bell}
        action={
          urgentAlerts.length > 0 && (
            <Badge variant="error">{urgentAlerts.length} urgent</Badge>
          )
        }
      />
      <CardBody className="space-y-4">
        {'Notification' in window && !notificationsEnabled && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-blue-600" />
              <span className="text-sm text-blue-800">Enable browser notifications for alerts</span>
            </div>
            <Button variant="secondary" size="sm" onClick={requestNotifications}>
              Enable
            </Button>
          </div>
        )}

        <div className="space-y-3">
          {alerts.map((alert) => (
            <div 
              key={alert.id}
              className={`p-4 rounded-lg border ${
                alert.status === 'expired' ? 'bg-red-50 border-red-200' :
                alert.status === 'expiring-soon' ? 'bg-amber-50 border-amber-200' :
                'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  {getStatusIcon(alert.status)}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-slate-900">{alert.type}</h4>
                      {getStatusBadge(alert.status, alert.daysRemaining)}
                    </div>
                    <p className="text-sm text-slate-500">{alert.issuer}</p>
                    <div className="flex items-center gap-1 mt-1 text-xs text-slate-400">
                      <Calendar className="w-3 h-3" />
                      <span>Expires: {alert.expiresAt.toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                {alert.status !== 'valid' && (
                  <Button variant="secondary" size="sm">
                    Renew
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        {alerts.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            <CheckCircle className="w-12 h-12 mx-auto mb-3 text-emerald-500" />
            <p>All your credentials are up to date!</p>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

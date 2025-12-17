import { NotificationItem as NotificationType, GlobalNotification } from "@/lib/firebase";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Film, AlertTriangle, Info, Bell, Tv, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

type NotificationProps = {
    notification: NotificationType | GlobalNotification;
    isRead: boolean;
    onClick: () => void;
};

export const NotificationItem = ({ notification, isRead, onClick }: NotificationProps) => {
    const navigate = useNavigate();

    const getIcon = () => {
        switch (notification.type) {
            case 'new_content': return <Film className="w-4 h-4 text-green-500" />;
            case 'plan_expiry': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
            case 'admin_message': return <Info className="w-4 h-4 text-blue-500" />;
            default: return <Bell className="w-4 h-4 text-gray-400" />;
        }
    };

    const handleClick = () => {
        onClick();
        if (notification.contentId) {
            navigate(`/content/${notification.contentId}`);
        }
        if (notification.type === 'plan_expiry') {
            navigate('/profile'); // or /payment
        }
    };

    return (
        <div
            onClick={handleClick}
            className={cn(
                "flex gap-3 p-4 hover:bg-white/5 cursor-pointer transition-colors border-b border-white/5 relative group",
                !isRead && "bg-white/[0.02]"
            )}
        >
            {!isRead && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-500" />
            )}

            <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                "bg-zinc-900 border border-white/10"
            )}>
                {getIcon()}
            </div>

            <div className="flex-1 min-w-0">
                <h4 className={cn("text-sm font-medium mb-1 truncate", !isRead ? "text-white" : "text-gray-400")}>
                    {notification.title}
                </h4>
                <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
                    {notification.message}
                </p>
                <span className="text-[10px] text-gray-500 mt-2 block">
                    {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true, locale: ptBR })}
                </span>
            </div>
        </div>
    );
};

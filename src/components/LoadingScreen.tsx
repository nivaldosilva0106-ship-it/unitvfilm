import { Film } from "lucide-react";

interface LoadingScreenProps {
  message?: string;
}

export const LoadingScreen = ({ message = "CARREGANDO" }: LoadingScreenProps) => {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0a0a0a]">
      {/* Logo Icon */}
      <div className="mb-6 rounded-xl bg-emerald-600 p-4 shadow-lg shadow-emerald-600/20">
        <Film className="h-10 w-10 text-white" />
      </div>

      {/* Brand Name */}
      <h1 className="mb-2 text-3xl font-bold tracking-tight">
        <span className="text-white">Uni</span>
        <span className="text-emerald-500">Tv</span>
        <span className="text-white">Film</span>
      </h1>

      {/* Loading Message */}
      <p className="mb-6 text-sm tracking-widest text-gray-400">{message}</p>

      {/* Spinner */}
      <div className="relative h-10 w-10">
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-emerald-500"></div>
      </div>
    </div>
  );
};

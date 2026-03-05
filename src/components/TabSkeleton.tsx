import grimLogga from "@/assets/grim-logga.png";

const TabSkeleton = () => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] animate-pulse">
    <img src={grimLogga} alt="Grim" className="w-32 h-32 object-contain opacity-60" />
  </div>
);

export default TabSkeleton;

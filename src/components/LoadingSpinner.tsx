import { motion } from "framer-motion";

export const LoadingSpinner = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] w-full max-w-xl mx-auto">
      <motion.div
        className="w-full glass-morphism rounded-lg p-1 overflow-hidden"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        <motion.div
          className="h-1 bg-gradient-to-r from-primary/50 via-primary to-primary/50 rounded-lg"
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ 
            duration: 1,
            ease: "easeInOut"
          }}
        />
      </motion.div>
    </div>
  );
}; 

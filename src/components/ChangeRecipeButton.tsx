"use client";

import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface ChangeRecipeButtonProps {
  onClick: () => void;
  isLoading?: boolean;
}

export function ChangeRecipeButton({
  onClick,
  isLoading = false,
}: ChangeRecipeButtonProps) {
  return (
    <Button
      onClick={onClick}
      disabled={isLoading}
      variant="outline"
      className="rounded-full border-gray-200 hover:bg-gray-50 px-6"
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          正在换...
        </>
      ) : (
        "🔄 换一道"
      )}
    </Button>
  );
}

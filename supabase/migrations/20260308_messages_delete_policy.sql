-- Add DELETE policy for messages table
-- Applied on 2026-03-08 via SQL Editor

-- Admins can delete any message where they are sender or receiver
CREATE POLICY "Admins can delete messages"
ON public.messages FOR DELETE
USING (
  (sender_id = auth.uid() OR receiver_id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Users can delete their own sent messages
CREATE POLICY "Users can delete own messages"
ON public.messages FOR DELETE
USING (sender_id = auth.uid());

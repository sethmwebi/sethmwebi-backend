/*
  Warnings:

  - You are about to drop the `post-categories` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `post-tags` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `verification-tokens` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "post-categories" DROP CONSTRAINT "post-categories_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "post-categories" DROP CONSTRAINT "post-categories_postId_fkey";

-- DropForeignKey
ALTER TABLE "post-tags" DROP CONSTRAINT "post-tags_postId_fkey";

-- DropForeignKey
ALTER TABLE "post-tags" DROP CONSTRAINT "post-tags_tagId_fkey";

-- DropTable
DROP TABLE "post-categories";

-- DropTable
DROP TABLE "post-tags";

-- DropTable
DROP TABLE "verification-tokens";

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_tokens_pkey" PRIMARY KEY ("identifier","token")
);

-- CreateTable
CREATE TABLE "post_categories" (
    "postId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "post_categories_pkey" PRIMARY KEY ("postId","categoryId")
);

-- CreateTable
CREATE TABLE "post_tags" (
    "postId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "post_tags_pkey" PRIMARY KEY ("postId","tagId")
);

-- AddForeignKey
ALTER TABLE "post_categories" ADD CONSTRAINT "post_categories_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_categories" ADD CONSTRAINT "post_categories_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_tags" ADD CONSTRAINT "post_tags_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_tags" ADD CONSTRAINT "post_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

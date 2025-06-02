import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from "@/components/ui/table"
  
  type Recipe = {
    id: number
    title: string
    summary: string
    instructions: string
    startSeason: number
    endSeason: number
    grade: number
    time: number
    createdAt: Date
    updatedAt: Date
    ingredients: { name: string; startSeason: number; endSeason: number }[]
  }
  
  export function DataTable({ recipes }: { recipes: Recipe[] }) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Summary</TableHead>
            <TableHead>Season</TableHead>
            <TableHead>Grade</TableHead>
            <TableHead>Time (min)</TableHead>
            <TableHead>Ingredients</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {recipes.map((recipe) => (
            <TableRow key={recipe.id}>
              <TableCell>{recipe.title}</TableCell>
              <TableCell>{recipe.summary}</TableCell>
              <TableCell>
                {recipe.startSeason} to {recipe.endSeason}
              </TableCell>
              <TableCell>{recipe.grade}</TableCell>
              <TableCell>{recipe.time}</TableCell>
              <TableCell>
                {recipe.ingredients.map((ing) => ing.name).join(', ')}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  }
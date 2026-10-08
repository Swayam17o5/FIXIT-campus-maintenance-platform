import cors from 'cors';
import express from 'express';
import routes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', routes);

app.get('/health',(req,res) => {
    return res.json({
        "status" : "healthy"
    })
})

app.use(notFoundHandler);
app.use(errorHandler);

export default app;

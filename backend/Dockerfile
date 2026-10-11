FROM golang:1.27-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./

RUN go mod download

COPY . .

RUN go build -o taskflow-backend .

FROM alpine:latest

WORKDIR /app

COPY --from=builder /app/taskflow-backend .

EXPOSE 8080

CMD ["./taskflow-backend"]
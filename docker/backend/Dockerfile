FROM eclipse-temurin:25-jdk-alpine AS build

WORKDIR /app

RUN apk add --no-cache maven

COPY Backend/java-api/pom.xml ./
COPY Backend/java-api/src ./src

RUN mvn -DskipTests package

FROM eclipse-temurin:25-jdk-alpine AS runtime

WORKDIR /app
COPY --from=build /app/target/biopresence-api-0.0.1-SNAPSHOT.jar ./app.jar

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "./app.jar"]
